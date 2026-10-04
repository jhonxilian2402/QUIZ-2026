import { createRoute } from "@/server/http/route";
import { noContent, ok, parseOrThrow, readJson } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { quizUpdateSchema } from "@/lib/api/schemas";
import * as quizService from "@/server/services/quizService";

/**
 * GET /api/quizzes/:id — the quiz with its questions.
 * PATCH /api/quizzes/:id — updates the definition.
 * DELETE /api/quizzes/:id — removes the quiz with its questions and attempts.
 *
 * Questions are returned with their answers because this is the authoring view.
 * An attempt reads its questions through the attempt endpoints, which withhold
 * the answer while the attempt is in progress.
 */

type Params = { id: string };

export const GET = createRoute<Params>("quizzes/get", async (_request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "GET",
    route: "quizzes/get",
  });

  const quiz = await quizService.getById(auth.userId, params.id);
  const questions = await quizService.getQuestions(auth.userId, params.id, true);
  return ok({ quiz, questions });
});

export const PATCH = createRoute<Params>("quizzes/update", async (request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "PATCH",
    route: "quizzes/update",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.write);

  const input = parseOrThrow(quizUpdateSchema, await readJson(request));
  return ok(await quizService.update(auth.userId, params.id, input));
});

export const DELETE = createRoute<Params>("quizzes/delete", async (_request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "DELETE",
    route: "quizzes/delete",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.write);

  await quizService.remove(auth.userId, params.id);
  return noContent();
});