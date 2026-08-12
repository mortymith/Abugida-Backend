/**
 * @module utils/errors
 * @description Error classification and safe message extraction utilities.
 */

/**
 * Error category used to route known, recoverable failures away from
 * unexpected internal errors.
 */
export type ErrorCategory = "connection" | "timeout" | "unknown";

/**
 * Classify an unknown error into a broad category based on its message.
 * Used to decide retry behaviour and which error messages are safe to surface.
 */
export function classifyError(error: unknown): ErrorCategory {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("connection") ||
    normalized.includes("econnrefused") ||
    normalized.includes("econnreset") ||
    normalized.includes("etimedout")
  ) {
    return "connection";
  }
  if (normalized.includes("timeout")) {
    return "timeout";
  }
  return "unknown";
}

/**
 * Safely extract a message from an unknown error.
 * Never throws. Recognised system errors (connection/timeout) pass their
 * message through; anything unexpected returns a generic fallback so that
 * internal details (e.g. secrets) are never leaked to callers.
 */
export function safeErrorMessage(error: unknown): string {
  const category = classifyError(error);
  if (category === "unknown") {
    return "An internal error occurred";
  }
  return error instanceof Error ? error.message : String(error);
}
