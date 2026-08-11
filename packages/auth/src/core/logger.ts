/**
 * @module core/logger
 *
 * A minimal, pluggable structured-logging contract. This package never
 * assumes a specific logging library (pino, winston, console, a hosted
 * sink) — consumers pass their own logger via `AuthConfig.logger`, and we
 * default to a safe no-op so nothing is required to get started.
 *
 * Design rules followed everywhere this is used:
 *   - Never log secrets: client secrets, private keys, session tokens,
 *     access/refresh tokens, or raw cookie values. Log ids (userId,
 *     sessionId, providerId) instead.
 *   - `error`/`warn` calls always pass a `context` object with at least
 *     `kind` (matching `AuthErrorKind` where applicable) so logs are
 *     filterable without string parsing.
 */

export type LogContext = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

/** Default logger: does nothing. Safe for production if the consumer never sets one. */
export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/**
 * A basic `console`-backed logger for local development. Not recommended
 * for production — plug in your structured logging library instead via
 * `AuthConfig.logger`.
 */
export function createConsoleLogger(namespace = "abugida-auth"): Logger {
  const format = (level: string, message: string, context?: LogContext) =>
    context && Object.keys(context).length > 0
      ? `[${namespace}] ${level} ${message} ${JSON.stringify(context)}`
      : `[${namespace}] ${level} ${message}`;

  return {
    debug: (message, context) => console.debug(format("debug", message, context)),
    info: (message, context) => console.info(format("info", message, context)),
    warn: (message, context) => console.warn(format("warn", message, context)),
    error: (message, context) => console.error(format("error", message, context)),
  };
}

/** Strips fields that must never reach a log sink, even if a caller passes them by mistake. */
const SENSITIVE_KEYS = new Set([
  "secret",
  "clientSecret",
  "privateKey",
  "accessToken",
  "refreshToken",
  "idToken",
  "token",
  "cookie",
  "password",
]);

export function redact(context: LogContext): LogContext {
  const safe: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    safe[key] = SENSITIVE_KEYS.has(key) ? "[redacted]" : value;
  }
  return safe;
}
