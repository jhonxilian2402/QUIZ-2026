import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import {
  AppError,
  InternalError,
  ValidationError,
} from "../errors";
import { logger } from "../logger";
import { REQUEST_ID_HEADER } from "../requestId";
import type { ApiErrorBody, ApiSuccessBody } from "@/lib/api/contracts";

/**
 * HTTP response helpers and centralized error handling.
 *
 * Success and error envelopes match the shared contract exactly, so the
 * frontend only ever parses one shape. Internal failures are logged with their
 * request id and returned without stack traces.
 */

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ data }, { status: 200, ...init });
}

export function created<T>(
  data: T,
  init?: ResponseInit
): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json({ data }, { status: 201, ...init });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function errorResponse(
  code: ApiErrorBody["error"]["code"],
  message: string,
  status: number,
  options: { details?: Record<string, string[]>; requestId?: string } = {}
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(options.details ? { details: options.details } : {}),
      ...(options.requestId ? { requestId: options.requestId } : {}),
    },
  };
  return NextResponse.json(body, { status });
}

/**
 * Converts a thrown value into the correct response.
 *
 * Only `AppError` messages marked as safe are exposed. Anything else becomes a
 * generic 500, and the technical detail is written to the server log with the
 * request id so it can still be diagnosed.
 */
export function handleError(
  error: unknown,
  context: { requestId: string; method: string; route: string; userId?: string }
): NextResponse<ApiErrorBody> {
  if (error instanceof ZodError) {
    const details: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join(".") || "(root)";
      (details[path] ??= []).push(issue.message);
    }
    return errorResponse("VALIDATION_ERROR", "The request was not valid.", 422, {
      details,
      requestId: context.requestId,
    });
  }

  if (error instanceof AppError) {
    const status = error.status;
    const message = error.expose ? error.message : "Something went wrong.";

    if (status >= 500) {
      logger.error("Request failed", {
        ...context,
        errorCategory: error.code,
        detail: error.message,
      });
    } else {
      logger.warn("Request rejected", {
        ...context,
        status,
        errorCategory: error.code,
      });
    }

    return errorResponse(error.code, message, status, {
      details: error.details,
      requestId: context.requestId,
    });
  }

  // Unexpected failures are logged in full and reported without detail.
  logger.error("Unhandled error", {
    ...context,
    errorCategory: "INTERNAL_ERROR",
    detail: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack?.split("\n").slice(0, 4).join(" | ") : undefined,
  });

  const internal = new InternalError("Something went wrong.");
  return errorResponse(internal.code, internal.message, internal.status, {
    requestId: context.requestId,
  });
}

/**
 * Validates a value against a schema, converting Zod failures into the
 * application's ValidationError so the error handler has a single path.
 * The backend never trusts client-side validation.
 */
export function parseOrThrow<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".") || "(root)";
      (details[path] ??= []).push(issue.message);
    }
    throw new ValidationError("The request was not valid.", { details });
  }
  return result.data;
}

/** Hard cap for a JSON API payload: chat caps at 8k chars, so 64 KB is ample. */
const MAX_JSON_BODY_BYTES = 64 * 1024;

/** Reads and parses a JSON body, rejecting oversized and malformed input. */
export async function readJson(request: Request): Promise<unknown> {
  // Unbounded JSON bodies are a DoS vector: enforce a hard cap before parsing.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_JSON_BODY_BYTES) {
    throw new ValidationError("The request body is too large.");
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new ValidationError("The request body could not be read.");
  }
  if (text.length > MAX_JSON_BODY_BYTES) {
    throw new ValidationError("The request body is too large.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("The request body must be valid JSON.");
  }
}

/** Applies the request id header to any response. */
export function withRequestId<T extends NextResponse>(
  response: T,
  requestId: string
): T {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}