import { createRoute } from "@/server/http/route";
import { noContent, ok } from "@/server/http/respond";
import { requireUser } from "@/server/http/context";
import { enforceRateLimit, RATE_LIMITS } from "@/server/rateLimit";
import * as fileService from "@/server/services/fileService";

/**
 * DELETE /api/files/:id — marks a file deleted for its owner.
 *
 * Soft deletion: the metadata row is retained so a future storage cleanup can
 * remove the object while the history stays auditable.
 */
type Params = { id: string };

export const GET = createRoute<Params>("files/get", async (_request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "GET",
    route: "files/get",
  });
  return ok({ file: await fileService.getById(auth.userId, params.id) });
});

export const DELETE = createRoute<Params>("files/delete", async (_request, { params }) => {
  const auth = await requireUser({
    requestId: "",
    method: "DELETE",
    route: "files/delete",
  });
  enforceRateLimit(auth.userId, RATE_LIMITS.write);

  await fileService.remove(auth.userId, params.id);
  return noContent();
});