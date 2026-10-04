import { createRoute } from "@/server/http/route";
import { created, ok, parseOrThrow } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { paginationSchema } from "@/lib/api/schemas";
import * as attemptService from "@/server/services/attemptService";

/**
 * GET /api/quizzes/:id/attempts — the caller's attempts for a quiz.
 * POST /api/quizzes/:id/attempts — starts a new attempt.
 *
 * The attempt is created server-side; the client cannot choose a starting score
 * or mark itself correct. A quiz with no questions is rejected rather than
 * silently filled with invented questions.
 */

type Params = { id: string };

export const GET = createRoute<Params>(
  "attempts/list",
  async (request, { params }) => {
    const auth = await requireUser({
      requestId: "",
      method: "GET",
      route: "attempts/list",
    });

    const url = new URL(request.url);
    const query = parseOrThrow(paginationSchema, {
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });

    return ok(
      await attemptService.listAttempts(auth.userId, params.id, {
        limit: query.limit,
        cursor: query.cursor,
      })
    );
  }
);

export const POST = createRoute<Params>(
  "attempts/create",
  async (_request, { params }) => {
    const auth = await requireUser({
      requestId: "",
      method: "POST",
      route: "attempts/create",
    });
    enforceRateLimit(auth.userId, RATE_LIMITS.write);

    return created(await attemptService.startAttempt(auth.userId, params.id));
  }
);