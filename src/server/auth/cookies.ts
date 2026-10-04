import { cookies } from "next/headers";
import { getEnv } from "../config/env";
import { CSRF_COOKIE_NAME } from "@/lib/api/csrf";

/**
 * Session cookie handling.
 *
 * The cookie is HTTP-only, SameSite=Lax and secure in production, so it is not
 * reachable from JavaScript and is not attached to cross-site form posts. The
 * value is an opaque random token; nothing sensitive is encoded in it.
 */
export const SESSION_COOKIE_NAME = "quiz_session";

/** Re-exported so the server and client share one definition. */
export { CSRF_COOKIE_NAME };
export const CSRF_HEADER_NAME = "x-csrf-token";

export type CookieOptions = {
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  path: string;
  maxAge?: number;
  expires?: Date;
};

export function sessionCookieOptions(maxAgeMs: number): CookieOptions {
  const env = getEnv();
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

export function csrfCookieOptions(maxAgeMs: number): CookieOptions {
  const env = getEnv();
  return {
    // Readable by the client so it can echo the value in a header; this is the
    // double-submit pattern, and the value is not a credential on its own.
    httpOnly: false,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

export async function readSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function setSessionCookie(
  token: string,
  maxAgeMs: number
): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(maxAgeMs));
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(0),
    maxAge: 0,
  });
}

export async function setCsrfCookie(value: string, maxAgeMs: number): Promise<void> {
  const store = await cookies();
  store.set(CSRF_COOKIE_NAME, value, csrfCookieOptions(maxAgeMs));
}

export async function readCsrfCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(CSRF_COOKIE_NAME)?.value ?? null;
}