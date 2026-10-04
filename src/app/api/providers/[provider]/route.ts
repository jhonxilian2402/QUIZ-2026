import { createRoute } from "@/server/http/route";
import { noContent, ok, parseOrThrow, readJson } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import { providerConfigureSchema } from "@/lib/api/schemas";
import * as providerService from "@/server/services/providerService";
import { NotFoundError } from "@/server/errors";
import { PROVIDER_IDS, type ProviderId } from "@/lib/api/contracts";

/**
 * GET    /api/providers/:provider — status for one provider.
 * POST   /api/providers/:provider/configure — stores configuration.
 * POST   /api/providers/:provider/test — tests the connection.
 * DELETE /api/providers/:provider — removes stored configuration.
 *
 * A submitted credential is converted to an opaque reference and is never
 * returned. OpenRouter itself is not called in this phase.
 */

type Params = { provider: string };

function toProviderId(value: string): ProviderId {
  const match = PROVIDER_IDS.find((id) => id === value);
  if (!match) {
    // Unknown providers surface as not found rather than an internal error.
    throw new NotFoundError("Unknown provider.");
  }
  return match;
}

export const GET = createRoute<Params>("providers/get", async (_request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "GET",
    route: "providers/get",
  });
  return ok(await providerService.get(auth.userId, toProviderId(params.provider)));
});

export const POST = createRoute<Params>("providers/configure", async (request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "POST",
    route: "providers/configure",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.write);

  const url = new URL(request.url);
  const providerId = toProviderId(params.provider);

  // The same path serves configure and test, distinguished by an explicit
  // `action` query parameter, so both share one provider abstraction.
  if (url.searchParams.get("action") === "test") {
    enforceRateLimit(auth.userId, RATE_LIMITS.providerTest);
    return ok(await providerService.test(auth.userId, providerId));
  }

  const input = parseOrThrow(providerConfigureSchema, await readJson(request));
  return ok(await providerService.configure(auth.userId, providerId, input));
});

export const DELETE = createRoute<Params>("providers/disconnect", async (_request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "DELETE",
    route: "providers/disconnect",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.write);

  await providerService.disconnect(auth.userId, toProviderId(params.provider));
  return noContent();
});