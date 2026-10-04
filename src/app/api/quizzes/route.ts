import { createRoute } from "@/server/http/route";
import { created, ok, parseOrThrow, readJson } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { paginationSchema, quizCreateSchema } from "@/lib/api/schemas";
import * as quizService from "@/server/services/quizService";

/**
 * GET /api/quizzes — the caller's quizzes, newest first, with search.
 * POST /api/quizzes — validates the configuration, runs the generation
 * pipeline and persists the quiz with its questions in one write. When
 * generation fails, no quiz is created and the error is returned verbatim.
 */

export const GET = createRoute("quizzes/list", async (request) => {
  const auth = await requireUser({
    requestId: "",
    method: "GET",
    route: "quizzes/list",
  });

  const url = new URL(request.url);
  const query = parseOrThrow(paginationSchema, {
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
  });

  return ok(
    await quizService.list(auth.userId, {
      limit: query.limit,
      cursor: query.cursor,
      search: query.search,
    })
  );
});

export const POST = createRoute("quizzes/create", async (request) => {
  const auth = await requireUser({
    requestId: "",
    method: "POST",
    route: "quizzes/create",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.quizCreate);

  const input = parseOrThrow(quizCreateSchema, await readJson(request));
  const result = await quizService.create(auth.userId, input);

  return created(result);
});