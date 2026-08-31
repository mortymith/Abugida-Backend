/**
 * Shared Pino logger instance.
 *
 * The logger writes structured JSON to stdout (info and below) and
 * stderr (warn and above) by default. It never communicates directly
 * with SigNoz or any external log aggregation service.
 *
 * Trace correlation (`trace_id`, `span_id`, `trace_flags`) is
 * achieved through a Pino `mixin` that reads the active OpenTelemetry
 * context on every log call — no `@opentelemetry/instrumentation-pino`
 * dependency required.
 */

import pino, { type Logger } from 'pino'
import { createTraceMergeObject } from './serializers'

let _logger: Logger | null = null

/**
 * Create (or return) the shared logger singleton.
 *
 * The `mixin` function runs on every log call and injects trace context
 * fields when a span is active, without creating fake IDs when no span
 * exists.
 */
export function createLogger(serviceName: string): Logger {
  if (_logger) {
    return _logger
  }

  _logger = pino({
    name: serviceName,
    level: process.env.LOG_LEVEL ?? 'info',
    // Pino serializes to stdout by default; errors go to stderr.
    // We keep the defaults and rely on the mixin for trace context.
    mixin() {
      return createTraceMergeObject()
    },
    // Redact known sensitive paths in any logged object.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        'password',
        'token',
        'secret',
        'accessToken',
        'refreshToken',
        'apiKey',
      ],
      censor: '[REDACTED]',
    },
    // Use a consistent timestamp format.
    timestamp: pino.stdTimeFunctions.isoTime,
  })

  return _logger
}

/**
 * The shared logger instance.
 *
 * Accessible as a named export so consumers can simply do:
 *
 * ```ts
 * import { logger } from "@abugida/observability";
 * logger.info({ userId }, "User logged in");
 * ```
 *
 * Throws if {@link initObservability} has not been called first.
 */
export function getLogger(): Logger {
  if (!_logger) {
    throw new Error(
      '[@abugida/observability] Logger not initialised. ' +
        'Call initObservability() before using the logger.',
    )
  }
  return _logger
}

/**
 * Reset the logger singleton. Intended for testing only.
 */
export function resetLogger(): void {
  _logger = null
}
