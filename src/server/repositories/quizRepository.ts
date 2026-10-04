import { and, asc, desc, eq, ilike, lt, sql } from "drizzle-orm";
import { ensureDbReady, getDb, withTransaction } from "../db/client";
import { quizQuestions, quizzes } from "../db/schema";
import type {
  QuizOptionPayload,
  QuizQuestionResponse,
  QuizResponse,
} from "@/lib/api/contracts";
import type { QuizCreateInput } from "@/lib/api/schemas";
import type { QuizConfigurationPayload } from "@/lib/api/contracts";

/**
 * Quiz repository. Ownership is part of every lookup, and quiz creation is
 * transactional because a quiz without its questions must never exist.
 */

export type QuizRow = typeof quizzes.$inferSelect;
export type QuizQuestionRow = typeof quizQuestions.$inferSelect;

export async function listQuizzes(options: {
  userId: string;
  limit: number;
  cursor?: string | null;
  search?: string;
}): Promise<{ items: QuizRow[]; nextCursor: string | null }> {
  await ensureDbReady();

  const conditions = [eq(quizzes.userId, options.userId)];
  if (options.search) {
    conditions.push(ilike(quizzes.subject, `%${options.search}%`));
  }
  if (options.cursor) {
    const cursorDate = new Date(options.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(quizzes.createdAt, cursorDate));
    }
  }

  const rows = await getDb()
    .select()
    .from(quizzes)
    .where(and(...conditions))
    .orderBy(desc(quizzes.createdAt))
    .limit(options.limit + 1);

  const hasMore = rows.length > options.limit;
  const items = hasMore ? rows.slice(0, options.limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;
  return { items, nextCursor };
}

export async function findQuizForUser(
  id: string,
  userId: string
): Promise<QuizRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.id, id), eq(quizzes.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Creates a quiz together with any questions supplied by a real generator.
 * Runs in one transaction so a partial quiz can never be observed.
 */
export async function insertQuiz(
  userId: string,
  input: QuizCreateInput,
  questions: Array<{
    statement: string;
    questionType: string;
    options: QuizOptionPayload[];
    correctAnswer: string | null;
    explanation: string | null;
    difficulty: string | null;
    sourceMetadata: Record<string, unknown> | null;
    /** Per-question source; falls back to the quiz-level sourceMode. */
    source?: QuizRow["sourceMode"];
  }> = []
): Promise<{ quiz: QuizRow; questions: QuizQuestionRow[] }> {
  await ensureDbReady();

  return withTransaction(async (tx) => {
    const [quiz] = await tx
      .insert(quizzes)
      .values({
        userId,
        title: input.title?.trim() || `${input.subject || "Untitled"} quiz`,
        subject: input.subject,
        topic: input.topic,
        difficulty: input.difficulty,
        questionType: input.questionType,
        academicLevel: input.academicLevel,
        questionCount: input.questionCount,
        sourceMode: input.sourceMode,
        timeLimit: input.timeLimit ?? null,
        configuration: input.configuration as QuizConfigurationPayload,
        status: input.status ?? "draft",
      })
      .returning();

    if (questions.length === 0) return { quiz, questions: [] };

    const inserted = await tx
      .insert(quizQuestions)
      .values(
        questions.map((question, index) => ({
          quizId: quiz.id,
          position: index + 1,
          statement: question.statement,
          questionType: question.questionType,
          options: question.options,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          source: question.source ?? input.sourceMode,
          sourceMetadata: question.sourceMetadata,
          difficulty: question.difficulty,
        }))
      )
      .returning();

    return { quiz, questions: inserted };
  });
}

export async function updateQuizForUser(
  id: string,
  userId: string,
  patch: Partial<QuizCreateInput>
): Promise<QuizRow | null> {
  await ensureDbReady();
  const [row] = await getDb()
    .update(quizzes)
    .set({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
      ...(patch.topic !== undefined ? { topic: patch.topic } : {}),
      ...(patch.difficulty !== undefined ? { difficulty: patch.difficulty } : {}),
      ...(patch.questionType !== undefined
        ? { questionType: patch.questionType }
        : {}),
      ...(patch.academicLevel !== undefined
        ? { academicLevel: patch.academicLevel }
        : {}),
      ...(patch.questionCount !== undefined
        ? { questionCount: patch.questionCount }
        : {}),
      ...(patch.sourceMode !== undefined ? { sourceMode: patch.sourceMode } : {}),
      ...(patch.timeLimit !== undefined ? { timeLimit: patch.timeLimit } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.configuration !== undefined
        ? { configuration: patch.configuration as QuizConfigurationPayload }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(quizzes.id, id), eq(quizzes.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteQuizForUser(id: string, userId: string): Promise<boolean> {
  await ensureDbReady();
  const rows = await getDb()
    .delete(quizzes)
    .where(and(eq(quizzes.id, id), eq(quizzes.userId, userId)))
    .returning();
  return rows.length > 0;
}

export async function listQuestions(quizId: string): Promise<QuizQuestionRow[]> {
  await ensureDbReady();
  return getDb()
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.position));
}

export async function countQuizzesForUser(userId: string): Promise<number> {
  await ensureDbReady();
  const [row] = await getDb()
    .select({ value: sql<number>`count(*)::int` })
    .from(quizzes)
    .where(eq(quizzes.userId, userId));
  return row?.value ?? 0;
}

/* ---------------- Serializers ---------------- */

export function toQuizResponse(row: QuizRow): QuizResponse {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    topic: row.topic,
    difficulty: row.difficulty,
    questionType: row.questionType,
    academicLevel: row.academicLevel,
    questionCount: row.questionCount,
    sourceMode: row.sourceMode,
    timeLimit: row.timeLimit,
    configuration: row.configuration,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Question serializer. `includeAnswer` controls whether the correct answer is
 * included, so a question served during an active attempt cannot be used to
 * cheat.
 */
export function toQuestionResponse(
  row: QuizQuestionRow,
  includeAnswer: boolean
): QuizQuestionResponse {
  return {
    id: row.id,
    quizId: row.quizId,
    position: row.position,
    statement: row.statement,
    questionType: row.questionType,
    options: row.options,
    ...(includeAnswer ? { correctAnswer: row.correctAnswer } : {}),
    explanation: includeAnswer ? row.explanation : null,
    source: row.source,
    sourceMetadata: row.sourceMetadata ?? null,
    difficulty: row.difficulty,
  };
}