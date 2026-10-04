import { createRoute } from "@/server/http/route";
import { ok, parseOrThrow } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { modelFiltersQuerySchema } from "@/lib/api/schemas";
import * as modelCatalogService from "@/server/services/modelCatalogService";
import type { AIModelCatalogResponse } from "@/lib/api/contracts";

/**
 * GET /api/ai/models — the normalized model catalog.
 *
 * Query parameters filter by capability (freeOnly, vision, streaming,
 * toolCalling, structuredOutput, minContext). The response is the
 * application's own format; raw provider payloads never leave the server.
 * The catalog is cached server-side, so this endpoint is cheap to poll and
 * needs no read rate limit.
 */
export const GET = createRoute("ai/models/list", async (request) => {
  await requireUser({
    requestId: "",
    method: "GET",
    route: "ai/models/list",
  });

  const query = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = parseOrThrow(modelFiltersQuerySchema, query);

  const catalog = await modelCatalogService.listModels({
    freeOnly: filters.freeOnly,
    vision: filters.vision,
    streaming: filters.streaming,
    toolCalling: filters.toolCalling,
    structuredOutput: filters.structuredOutput,
    minContext: filters.minContext,
  });

  return ok<AIModelCatalogResponse>(catalog);
});
