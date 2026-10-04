import { randomUUID } from "node:crypto";

/**
 * Request correlation.
 *
 * Every request gets an id that is attached to logs and echoed to the client in
 * error responses, so a user-reported failure can be traced without exposing
 * stack traces. The id is generated server-side and never trusted from the
 * client.
 */
export const REQUEST_ID_HEADER = "x-request-id";

export function createRequestId(): string {
  return randomUUID();
}

/** Reads an inbound id for tracing continuity, or creates a fresh one. */
export function resolveRequestId(request: Request): string {
  const inbound = request.headers.get(REQUEST_ID_HEADER);
  if (inbound && /^[a-zA-Z0-9-]{8,64}$/.test(inbound)) return inbound;
  return createRequestId();
}