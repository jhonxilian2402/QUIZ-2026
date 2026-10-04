import { createRoute } from "@/server/http/route";
import { ok } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import * as attemptService from "@/server/services/attemptService";
import * as quizService from "@/server/services/quizService";

/**
 * GET /api/attempts/:id — the attempt, its answers and its questions.
 *
 * While an attempt is in progress the questions are returned without their
 * correct answers, so an in-flight attempt cannot be used to read the key. Once
 * the attempt is completed the answers and explanations become available.
 */

type Params = { id: string };

export const GET = createRoute<Params>("attempts/get", async (_request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "GET",
    route: "attempts/get",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.write);

  const { attempt, answers } = await attemptService.getAttempt(auth.userId, params.id);
  const includeAnswers = attempt.status === "completed" || attempt.status === "expired";
  const questions = await quizService.getQuestions(
    auth.userId,
    attempt.quizId,
    includeAnswers
  );

  return ok({ attempt, answers, questions });
});