import { getEnv } from "./config/env";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  userId?: string;
  errorCategory?: string;
  [key: string]: unknown;
};

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Field names that must never be logged. Values are replaced rather than
 * dropped, so a log line still shows that the field existed.
 */
const FORBIDDEN_KEYS = [
  "password",
  "passwordhash",
  "credential",
  "apikey",
  "api_key",
  "token",
  "secret",
  "authorization",
  "cookie",
];

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.some((forbidden) => key.toLowerCase().includes(forbidden))) {
      out[key] = "[redacted]";
    } else {
      out[key] = redact(item, depth + 1);
    }
  }
  return out;
}

/**
 * Structured single-line JSON logger.
 *
 * Output is one JSON object per line so it can be shipped to any collector.
 * Sensitive keys are redacted by name, and errors are reduced to name/message
 * so stack traces and driver payloads are not emitted with user data.
 */
function emit(level: LogLevel, message: string, context: LogContext = {}): void {
  const env = getEnv();
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[env.LOG_LEVEL]) return;

  const payload = {
    level,
    time: new Date().toISOString(),
    message,
    env: env.NODE_ENV,
    ...(redact(context) as Record<string, unknown>),
  };

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};