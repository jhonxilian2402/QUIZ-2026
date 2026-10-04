import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "../config/env";

/**
 * Session token generation and hashing.
 *
 * The browser receives a random opaque token in an HTTP-only cookie. Only a
 * keyed hash of that token is stored, so a database disclosure does not yield
 * usable sessions, and the token can be looked up by its deterministic hash
 * without storing the secret itself.
 */

/** 32 random bytes, base64url encoded. */
export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Deterministic keyed hash used for storage and lookup. */
export function hashSessionToken(token: string): string {
  return createHmac("sha256", getEnv().authSecret).update(token).digest("hex");
}

/** Constant-time comparison for token-shaped values. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour

export function createPasswordResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Hashes a client IP for storage. The raw address is never persisted, which
 * keeps session records useful for abuse detection without storing personal
 * network data.
 */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHmac("sha256", getEnv().authSecret).update(ip).digest("hex").slice(0, 32);
}