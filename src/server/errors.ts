import type { ErrorCode } from "@/lib/api/contracts";

/**
 * Backend error taxonomy.
 *
 * Each error class carries the HTTP status and the machine-readable code the
 * client contract expects. `expose` decides whether the message is safe to
 * return; anything with `expose: false` is replaced by a generic message so
 * internal detail never reaches a client.
 */
export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;
  abstract readonly status: number;
  readonly expose: boolean;
  readonly details?: Record<string, string[]>;

  constructor(
    message: string,
    options: { expose?: boolean; details?: Record<string, string[]>; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = new.target.name;
    this.expose = options.expose ?? true;
    this.details = options.details;
  }
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR" as const;
  readonly status = 422;
}

export class AuthenticationError extends AppError {
  readonly code = "UNAUTHORIZED" as const;
  readonly status = 401;
}

export class AuthorizationError extends AppError {
  readonly code = "FORBIDDEN" as const;
  readonly status = 403;
}

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND" as const;
  readonly status = 404;
}

export class ConflictError extends AppError {
  readonly code = "CONFLICT" as const;
  readonly status = 409;
}

export class RateLimitError extends AppError {
  readonly code = "RATE_LIMITED" as const;
  readonly status = 429;
}

export class ProviderError extends AppError {
  readonly code = "PROVIDER_ERROR" as const;
  readonly status = 502;
}

export class DatabaseError extends AppError {
  readonly code = "DATABASE_ERROR" as const;
  readonly status = 500;
}

export class InternalError extends AppError {
  readonly code = "INTERNAL_ERROR" as const;
  readonly status = 500;
}

export class BadRequestError extends AppError {
  readonly code = "VALIDATION_ERROR" as const;
  readonly status = 400;
}

/* ------------------------------------------------------------------
   AI provider errors
   Each carries a machine-readable code the frontend can branch on. Raw
   provider payloads stay server-side; messages here are safe to show.
   ------------------------------------------------------------------ */

export type AIErrorCode = Extract<
  ErrorCode,
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_AUTHENTICATION_FAILED"
  | "AI_MODEL_UNAVAILABLE"
  | "AI_RATE_LIMITED"
  | "AI_REQUEST_TIMEOUT"
  | "AI_INVALID_REQUEST"
  | "AI_CONTENT_ERROR"
  | "AI_CONTEXT_TOO_LARGE"
  | "AI_UNKNOWN_ERROR"
>;

export class AIError extends AppError {
  readonly retryAfterSeconds?: number;
  readonly code: ErrorCode;
  readonly status: number;

  constructor(
    readonly aiCode: AIErrorCode,
    message: string,
    options: {
      expose?: boolean;
      retryAfterSeconds?: number;
      cause?: unknown;
    } = {}
  ) {
    super(message, {
      expose: options.expose,
      cause: options.cause,
      details:
        options.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: [String(options.retryAfterSeconds)] }
          : undefined,
    });
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.code = aiCode;
    this.status = AI_ERROR_STATUSES[aiCode];
  }
}

const AI_ERROR_STATUSES: Record<AIErrorCode, number> = {
  AI_RATE_LIMITED: 429,
  AI_REQUEST_TIMEOUT: 504,
  AI_MODEL_UNAVAILABLE: 409,
  AI_INVALID_REQUEST: 400,
  AI_CONTEXT_TOO_LARGE: 413,
  // Provider-side failures are reported as a bad gateway: the client did
  // nothing wrong and retrying later may succeed.
  AI_PROVIDER_UNAVAILABLE: 502,
  AI_AUTHENTICATION_FAILED: 502,
  AI_CONTENT_ERROR: 502,
  AI_UNKNOWN_ERROR: 502,
};

/**
 * PostgreSQL driver error shape we care about. Constraint violations are mapped
 * to precise application errors instead of leaking SQL to clients.
 */
type PostgresError = {
  code?: string;
  constraint?: string;
};

export function isPostgresError(value: unknown): value is PostgresError {
  return typeof value === "object" && value !== null && "code" in value;
}

/** 23505 = unique violation, 23503 = foreign key violation, 23514 = check. */
export function mapDatabaseError(error: unknown): AppError {
  if (isPostgresError(error)) {
    if (error.code === "23505") {
      return new ConflictError("That value is already in use.", { cause: error });
    }
    if (error.code === "23503") {
      return new ConflictError("Related record is missing or still referenced.", {
        cause: error,
      });
    }
    if (error.code === "23514") {
      return new ValidationError("A value violates a database constraint.", {
        cause: error,
      });
    }
  }
  return new DatabaseError("The database could not complete the operation.", {
    expose: false,
    cause: error,
  });
}