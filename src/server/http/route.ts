import { handleError, withRequestId } from "./respond";
import { createRequestId } from "../requestId";
import { assertCsrf, ensureCsrfCookie } from "./context";
import { logger } from "../logger";
import { AuthorizationError } from "../errors";

/**
 * Route wrapper.
 *
 * Every API handler is created through this function, which centralizes the
 * concerns that must never be forgotten per-route:
 *   - a correlation id on every response,
 *   - CSRF verification for state-changing methods,
 *   - structured request logging with status and duration,
 *   - error translation into the shared error contract.
 *
 * Handlers therefore only validate, call a service and return a response.
 */

export type RouteContext<P> = {
  requestId: string;
  params: P;
};

/**
 * Next.js validates exported route handlers against a generated signature, so
 * the second parameter is typed as the framework's context shape (params as a
 * promise) rather than a custom object.
 */
type NextRouteContext = { params: Promise<Record<string, string>> };

export function createRoute<P extends Record<string, string> = Record<string, never>>(
  routeName: string,
  handler: (request: Request, context: RouteContext<P>) => Promise<Response>
): (request: Request, context: NextRouteContext) => Promise<Response> {
  return async (request: Request, context: NextRouteContext): Promise<Response> => {
    const started = Date.now();
    const requestId = createRequestId();
    const method = request.method.toUpperCase();

    const userId: string | undefined = undefined;

    try {
      // Safe methods issue the CSRF companion cookie when it is missing, so a
      // first-time visitor can satisfy the double-submit check on their first
      // mutating request (registration, for example).
      const method = request.method.toUpperCase();
      if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
        await ensureCsrfCookie();
      }

      await assertCsrf(request);

      const params = ((await context?.params) ?? {}) as P;
      const response = await handler(request, { requestId, params });

      response.headers.set("x-request-id", requestId);
      logger.info("Request handled", {
        requestId,
        route: routeName,
        method,
        status: response.status,
        durationMs: Date.now() - started,
        userId,
      });
      return response;
    } catch (error) {
      const response = handleError(error, {
        requestId,
        method,
        route: routeName,
        userId,
      });
      return withRequestId(response, requestId);
    }
  };
}

/** Records the acting user for logging once authentication has succeeded. */
export function markUser(context: RouteContext<unknown> & { userId?: string }, userId: string): void {
  context.userId = userId;
}

export function isMutation(request: Request): boolean {
  const method = request.method.toUpperCase();
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

export { AuthorizationError };