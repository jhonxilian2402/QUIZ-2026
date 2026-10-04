import { cookies, headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { AuthenticationError, AuthorizationError } from "../errors";
import { readSessionCookie, setCsrfCookie } from "../auth/cookies";
import { resolveSessionUser } from "../services/authService";
import { SESSION_TTL_MS, safeEqual } from "../auth/tokens";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/api/csrf";
import type { SessionUser } from "@/lib/api/contracts";

/**
 * Request context and authorization guards.
 *
 * Every authenticated route obtains the current user through here rather than
 * reading cookies itself, so session resolution and CSRF checks cannot be
 * forgotten in one handler.
 */

export type RequestContext = {
  requestId: string;
  method: string;
  route: string;
};

export type AuthContext = RequestContext & {
  user: SessionUser;
  userId: string;
  /** Raw session token, needed only for logout. */
  sessionToken: string | null;
};

/** Resolves the signed-in user, or null when unauthenticated. */
export async function getCurrentUser(): Promise<{
  user: SessionUser;
  userId: string;
  expiresAt: Date;
} | null> {
  const token = await readSessionCookie();
  const session = await resolveSessionUser(token);
  if (!session) return null;
  return { user: session.user, userId: session.userId, expiresAt: session.expiresAt };
}

/** Requires a signed-in user. Throws 401 when absent. */
export async function requireUser(context: RequestContext): Promise<AuthContext> {
  const token = await readSessionCookie();
  const session = await resolveSessionUser(token);

  if (!session) {
    throw new AuthenticationError("You must be signed in to do that.");
  }

  return {
    ...context,
    user: session.user,
    userId: session.userId,
    sessionToken: token,
  };
}

/**
 * Double-submit CSRF check for state-changing requests.
 *
 * The cookie value must match the header value. SameSite=Lax already blocks
 * cross-site form posts in modern browsers; this check covers the cases
 * SameSite alone does not, such as subdomain or same-site deployments.
 */
export async function assertCsrf(request: Request): Promise<void> {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const store = await cookies();
  const cookieValue = store.get(CSRF_COOKIE_NAME)?.value ?? null;
  const headerValue = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieValue || !headerValue || !safeEqual(cookieValue, headerValue)) {
    throw new AuthorizationError("The request could not be verified. Refresh and try again.");
  }
}

/**
 * Ensures a CSRF companion cookie exists.
 *
 * Called on safe requests so a visitor receives the token before their first
 * mutating request. Without this, registration could never satisfy the
 * double-submit check, because no token would exist yet.
 */
export async function ensureCsrfCookie(): Promise<void> {
  const store = await cookies();
  if (store.get(CSRF_COOKIE_NAME)?.value) return;
  await setCsrfCookie(randomBytes(32).toString("base64url"), SESSION_TTL_MS);
}

/** Extracts the client address from forwarded headers, when present. */
export async function clientIp(): Promise<string | null> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return store.get("x-real-ip");
}

export async function userAgent(): Promise<string | null> {
  const store = await headers();
  return store.get("user-agent");
}