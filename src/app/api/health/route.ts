import { pingDatabase } from "@/server/db/client";
import { ok } from "@/server/http/respond";
import type { HealthResponse } from "@/lib/api/contracts";

/**
 * Liveness probe. Reports application availability and whether the database
 * answered a trivial query, without exposing any infrastructure detail.
 *
 * Deliberately unauthenticated: a health check must be reachable by a platform
 * load balancer. It returns no user or configuration data.
 */
export async function GET() {
  const databaseOk = await pingDatabase();
  return ok<HealthResponse>({
    status: "ok",
    database: databaseOk ? "ok" : "unavailable",
  });
}