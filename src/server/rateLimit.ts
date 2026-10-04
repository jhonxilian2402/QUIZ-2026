import { RateLimitError } from "./errors";

type Bucket = {
  count: number;
  resetAt: number;
};

/**
 * In-process fixed-window rate limiter.
 *
 * This is a foundation, not a shared store: it protects a single instance and
 * is deliberately tolerant of normal use. A multi-instance deployment must move
 * this behind a shared backend (for example Redis) without changing call sites.
 */
const buckets = new Map<string, Bucket>();

/** Removes expired buckets so the map cannot grow without bound. */
function sweep(now: number): void {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitOptions = {
  /** Stable name for the limit, e.g. "auth:login". */
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export function checkRateLimit(
  identifier: string,
  { key, limit, windowMs }: RateLimitOptions,
  now = Date.now()
): RateLimitResult {
  sweep(now);

  const bucketKey = `${key}:${identifier}`;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Throws a RateLimitError when the caller has exceeded the window. */
export function enforceRateLimit(
  identifier: string,
  options: RateLimitOptions
): void {
  const result = checkRateLimit(identifier, options);
  if (!result.allowed) {
    const seconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    throw new RateLimitError(
      `Too many requests. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`
    );
  }
}

/**
 * Named limit profiles. Deliberately generous so normal use is never blocked;
 * AI-specific limits belong to a later phase.
 */
export const RATE_LIMITS = {
  authLogin: { key: "auth:login", limit: 10, windowMs: 60_000 },
  authRegister: { key: "auth:register", limit: 5, windowMs: 60 * 60_000 },
  authReset: { key: "auth:reset", limit: 5, windowMs: 60 * 60_000 },
  conversationCreate: { key: "conversation:create", limit: 60, windowMs: 60_000 },
  messageCreate: { key: "message:create", limit: 120, windowMs: 60_000 },
  /** AI turns are expensive: a firm ceiling that normal use never reaches. */
  chatGenerate: { key: "chat:generate", limit: 20, windowMs: 60_000 },
  quizCreate: { key: "quiz:create", limit: 60, windowMs: 60_000 },
  fileCreate: { key: "file:create", limit: 60, windowMs: 60_000 },
  providerTest: { key: "provider:test", limit: 20, windowMs: 60_000 },
  /** Explicit catalog revalidation hits the provider, so it stays tight. */
  aiCatalogRefresh: { key: "ai:catalog-refresh", limit: 6, windowMs: 60_000 },
  write: { key: "write", limit: 300, windowMs: 60_000 },
  read: { key: "read", limit: 600, windowMs: 60_000 },
  fileSearch: { key: "file:search", limit: 120, windowMs: 60_000 },
} as const;

/** Test helper: clears all buckets between test cases. */
export function resetRateLimits(): void {
  buckets.clear();
}