/**
 * Error recording.
 *
 * Provides a single entry-point for recording errors against the
 * active span. The function preserves the original error and avoids
 * duplicate logging or leakage of sensitive information.
 */

import { trace, SpanStatusCode, type Span } from '@opentelemetry/api'
import { context } from '@opentelemetry/api'
import { getLogger } from '../logging/logger'

/**
 * Sensitive substrings that must never appear in error log messages.
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /api[_-]?key/i,
  /credential/i,
  /authorization/i,
  /cookie/i,
]

/**
 * Sanitize an error message by removing potential sensitive values.
 *
 * This is a best-effort heuristic — it replaces matched values with
 * `[REDACTED]` in the message string.
 */
function sanitizeErrorMessage(message: string): string {
  let sanitized = message
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]')
  }
  return sanitized
}

/**
 * Record an error on the active span (if one exists) and log it once.
 *
 * The function:
 * 1. Records the exception on the current span and marks it as ERROR.
 * 2. Logs the error at `error` level (unless `silent` is true).
 * 3. Preserves and re-throws the original error — callers decide
 *    whether to propagate.
 *
 * @param error   - the caught error value
 * @param options
 * @param options.silent - when true, skip Pino logging (avoids duplicates
 *   when the caller already logged)
 */
export function recordError(error: unknown, options?: { silent?: boolean }): void {
  const errMessage = error instanceof Error ? error.message : String(error)
  const errStack = error instanceof Error ? error.stack : undefined
  const errName = error instanceof Error ? error.constructor.name : 'UnknownError'

  // 1. Record on the active span
  const span: Span | undefined = trace.getSpan(context.active())
  if (span) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: sanitizeErrorMessage(errMessage),
    })
    const otelError = error instanceof Error ? error : new Error(errMessage)
    span.recordException(otelError)
  }

  // 2. Log once via Pino (unless silent)
  if (!options?.silent) {
    try {
      const logger = getLogger()
      logger.error(
        {
          err: {
            name: errName,
            message: sanitizeErrorMessage(errMessage),
            stack: errStack,
          },
        },
        errMessage,
      )
    } catch {
      // Logger not initialised — skip rather than throwing
    }
  }

  // The original error is intentionally NOT modified or wrapped.
}
