import { and, asc, desc, eq, sql } from "drizzle-orm";
import { ensureDbReady, getDb, withTransaction } from "../db/client";
import { quizAnswers, quizAttempts, quizQuestions, quizzes } from "../db/schema";
import type { QuizAnswerResponse, QuizAttemptResponse } from "@/lib/api/contracts";

/**
 * Attempt repository.
 *
 * Correctness is decided here from stored answers. The client never supplies a
 * score, and the unique index on (attemptId, questionId) makes re-answering an
 * update rather than a duplicate.
 */

export type AttemptRow = typeof quizAttempts.$inferSelect;
export type AnswerRow = typeof quizAnswers.$inferSelect;

export async function insertAttempt(input: {
  quizId: string;
  userId: string;
  /** Overridable for deterministic timer tests; defaults to now. */
  startedAt?: Date;
  /** Server-authoritative deadline; null for untimed quizzes. */
  expiresAt?: Date | null;
}): Promise<AttemptRow> {
  await ensureDbReady();
  const startedAt = input.startedAt ?? new Date();
  const [row] = await getDb()
    .insert(quizAttempts)
    .values({
      quizId: input.quizId,
      userId: input.userId,
      startedAt,
      expiresAt: input.expiresAt ?? null,
    })
    .returning();
  return row;
}

/** True when the attempt is still open but its server-side deadline passed. */
export function isAttemptExpired(attempt: AttemptRow, now = new Date()): boolean {
  return (
    attempt.status === "in-progress" &&
    attempt.expiresAt !== null &&
    now.getTime() > attempt.expiresAt.getTime()
  );
}

/**
 * Marks an expired attempt as expired, scoring whatever answers exist. The
 * client can never extend this window; it is derived from stored timestamps.
 */
export async function expireAttempt(
  attempt: AttemptRow
): Promise<AttemptRow> {
  await ensureDbReady();
  return withTransaction(async (tx) => {
    const questions = await tx
      .select({ id: quizQuestions.id })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, attempt.quizId));

    const answers = await tx
      .select()
      .from(quizAnswers)
      .where(eq(quizAnswers.attemptId, attempt.id));

    const answered = new Map(answers.map((answer) => [answer.questionId, answer]));
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;
    for (const question of questions) {
      const answer = answered.get(question.id);
      if (!answer || answer.selectedAnswer === null) unanswered += 1;
      else if (answer.isCorrect) correct += 1;
      else incorrect += 1;
    }

    const total = questions.length;
    const score = total > 0 ? Math.round((correct / total) * 10000) / 100 : null;
    const now = new Date();

    const [row] = await tx
      .update(quizAttempts)
      .set({
        status: "expired",
        completedAt: attempt.expiresAt ?? now,
        score,
        correctCount: correct,
        incorrectCount: incorrect,
        unansweredCount: unanswered,
        durationSeconds: Math.max(
          0,
          Math.round(
            ((attempt.expiresAt ?? now).getTime() - attempt.startedAt.getTime()) / 1000
          )
        ),
      })
      .where(eq(quizAttempts.id, attempt.id))
      .returning();
    return row;
  });
}

/** Attempts are user-owned, so the lookup is scoped by userId. */
export async function findAttemptForUser(
  id: string,
  userId: string
): Promise<AttemptRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.id, id), eq(quizAttempts.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listAttemptsForQuiz(options: {
  quizId: string;
  userId: string;
  limit: number;
  cursor?: string | null;
}): Promise<{ items: AttemptRow[]; nextCursor: string | null }> {
  await ensureDbReady();
  const conditions = [
    eq(quizAttempts.quizId, options.quizId),
    eq(quizAttempts.userId, options.userId),
  ];
  if (options.cursor) {
    const cursorDate = new Date(options.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(sql`${quizAttempts.startedAt} < ${cursorDate.toISOString()}`);
    }
  }

  const rows = await getDb()
    .select()
    .from(quizAttempts)
    .where(and(...conditions))
    .orderBy(desc(quizAttempts.startedAt))
    .limit(options.limit + 1);

  const hasMore = rows.length > options.limit;
  const items = hasMore ? rows.slice(0, options.limit) : rows;
  const nextCursor = hasMore
    ? items[items.length - 1].startedAt.toISOString()
    : null;
  return { items, nextCursor };
}

export type RecordAnswerInput = {
  attemptId: string;
  questionId: string;
  selectedAnswer: string | null;
};

/**
 * Records an answer and derives correctness from the stored question.
 *
 * The comparison happens server-side: the client's claim about correctness is
 * never read. Re-submitting a question updates the existing row.
 */
export async function recordAnswer(
  input: RecordAnswerInput
): Promise<{ answer: AnswerRow; isCorrect: boolean } | null> {
  await ensureDbReady();

  return withTransaction(async (tx) => {
    const [question] = await tx
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.id, input.questionId))
      .limit(1);
    if (!question) return null;

    // Compare against the stored answer, normalised for case and spacing.
    const expected = question.correctAnswer?.trim().toLowerCase() ?? null;
    const given = input.selectedAnswer?.trim().toLowerCase() ?? null;
    const isCorrect = expected !== null && given !== null && expected === given;

    const [answer] = await tx
      .insert(quizAnswers)
      .values({
        attemptId: input.attemptId,
        questionId: input.questionId,
        selectedAnswer: input.selectedAnswer,
        isCorrect,
        answeredAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [quizAnswers.attemptId, quizAnswers.questionId],
        set: {
          selectedAnswer: input.selectedAnswer,
          isCorrect,
          answeredAt: new Date(),
        },
      })
      .returning();

    return { answer, isCorrect };
  });
}

/**
 * Finalises an attempt by scoring every question in the quiz.
 *
 * Counts are recomputed from stored answers rather than accumulated from client
 * input, so an interrupted or replayed submission cannot inflate a score.
 */
export async function completeAttempt(
  attemptId: string,
  userId: string
): Promise<AttemptRow | null> {
  await ensureDbReady();

  return withTransaction(async (tx) => {
    const [attempt] = await tx
      .select()
      .from(quizAttempts)
      .where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId)))
      .limit(1);
    if (!attempt) return null;

    // Idempotent completion: a retried request replays the stored result.
    if (attempt.status === "completed" || attempt.status === "expired") {
      return attempt;
    }

    const questions = await tx
      .select({ id: quizQuestions.id })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, attempt.quizId));

    const answers = await tx
      .select()
      .from(quizAnswers)
      .where(eq(quizAnswers.attemptId, attemptId));

    const answered = new Map(answers.map((answer) => [answer.questionId, answer]));

    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;

    for (const question of questions) {
      const answer = answered.get(question.id);
      if (!answer || answer.selectedAnswer === null) unanswered += 1;
      else if (answer.isCorrect) correct += 1;
      else incorrect += 1;
    }

    const total = questions.length;
    const score = total > 0 ? Math.round((correct / total) * 10000) / 100 : null;
    const completedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.round((completedAt.getTime() - attempt.startedAt.getTime()) / 1000)
    );

    // A client calling complete after the deadline does not get a free pass:
    // the attempt is finalized as expired, keeping the stored answer state.
    const expired = isAttemptExpired(attempt, completedAt);

    const [row] = await tx
      .update(quizAttempts)
      .set({
        status: expired ? "expired" : "completed",
        completedAt,
        score,
        correctCount: correct,
        incorrectCount: incorrect,
        unansweredCount: unanswered,
        durationSeconds: expired
          ? Math.max(
              0,
              Math.round(
                ((attempt.expiresAt ?? completedAt).getTime() -
                  attempt.startedAt.getTime()) /
                  1000
              )
            )
          : durationSeconds,
      })
      .where(eq(quizAttempts.id, attemptId))
      .returning();

    return row;
  });
}

export async function listAnswers(attemptId: string): Promise<AnswerRow[]> {
  await ensureDbReady();
  return getDb()
    .select()
    .from(quizAnswers)
    .where(eq(quizAnswers.attemptId, attemptId))
    .orderBy(asc(quizAnswers.answeredAt));
}

/** Question ids for a quiz, used to validate attempt scope. */
export async function listQuestionIdsForQuiz(quizId: string): Promise<string[]> {
  await ensureDbReady();
  const rows = await getDb()
    .select({ id: quizQuestions.id })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.position));
  return rows.map((row) => row.id);
}

/** Confirms a quiz belongs to the user before an attempt is created. */
export async function quizBelongsToUser(
  quizId: string,
  userId: string
): Promise<boolean> {
  await ensureDbReady();
  const [row] = await getDb()
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export async function summarizeQuizzes(quizIds: string[]): Promise<
  Map<
    string,
    {
      questionTotal: number;
      latestAttempt: {
        score: number | null;
        status: QuizAttemptResponse["status"];
        completedAt: string | null;
      } | null;
    }
  >
> {
  await ensureDbReady();
  const result = new Map<
    string,
    {
      questionTotal: number;
      latestAttempt: {
        score: number | null;
        status: QuizAttemptResponse["status"];
        completedAt: string | null;
      } | null;
    }
  >();
  if (quizIds.length === 0) return result;

  const questionRows = await getDb()
    .select({ quizId: quizQuestions.quizId, value: sql<number>`count(*)::int` })
    .from(quizQuestions)
    .where(sql`${quizQuestions.quizId} in (${sql.join(quizIds.map((id) => sql`${id}`), sql`, `)})`)
    .groupBy(quizQuestions.quizId);

  const attemptRows = await getDb()
    .select()
    .from(quizAttempts)
    .where(sql`${quizAttempts.quizId} in (${sql.join(quizIds.map((id) => sql`${id}`), sql`, `)})`)
    .orderBy(desc(quizAttempts.startedAt));

  for (const id of quizIds) result.set(id, { questionTotal: 0, latestAttempt: null });
  for (const row of questionRows) {
    const entry = result.get(row.quizId);
    if (entry) entry.questionTotal = row.value;
  }
  for (const row of attemptRows) {
    const entry = result.get(row.quizId);
    if (entry && !entry.latestAttempt) {
      entry.latestAttempt = {
        score: row.score,
        status: row.status,
        completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      };
    }
  }
  return result;
}

export async function countActiveAttemptsForUser(userId: string): Promise<number> {
  await ensureDbReady();
  const [row] = await getDb()
    .select({ value: sql<number>`count(*)::int` })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.status, "in-progress")));
  return row?.value ?? 0;
}

/* ---------------- Serializers ---------------- */

export function toAttemptResponse(row: AttemptRow): QuizAttemptResponse {
  return {
    id: row.id,
    quizId: row.quizId,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    score: row.score,
    correctCount: row.correctCount,
    incorrectCount: row.incorrectCount,
    unansweredCount: row.unansweredCount,
    durationSeconds: row.durationSeconds,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  };
}

export function toAnswerResponse(row: AnswerRow): QuizAnswerResponse {
  return {
    id: row.id,
    attemptId: row.attemptId,
    questionId: row.questionId,
    selectedAnswer: row.selectedAnswer,
    isCorrect: row.isCorrect,
    answeredAt: row.answeredAt.toISOString(),
  };
}