import { createRoute } from "@/server/http/route";
import { created, parseOrThrow, readJson } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { answerSubmitSchema } from "@/lib/api/schemas";
import * as attemptService from "@/server/services/attemptService";

/**
 * POST /api/attempts/:id/answers — submits one answer.
 *
 * The request carries the selected option and the question id only. Correctness
 * is derived from the stored question server-side; because the payload schema
 * is strict, a client-supplied `isCorrect` would be rejected outright.
 */

type Params = { id: string };

export const POST = createRoute<Params>("attempts/answer", async (request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "POST",
    route: "attempts/answer",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.write);

  const input = parseOrThrow(answerSubmitSchema, await readJson(request));
  const answer = await attemptService.submitAnswer(
    auth.userId,
    params.id,
    input.questionId,
    input.selectedAnswer
  );

  return created(answer);
});