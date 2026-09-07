/**
 * @module integrations/errors
 * @description Base error type for external service integrations
 * (Telebirr, SMSEthiopia). Extends the queue error hierarchy with a
 * retryability flag so job processors can distinguish transient transport
 * failures (worth a job retry) from permanent rejections (not worth one).
 */

import { QueueError } from '../core/types.js'

/**
 * Base class for all external service integration errors.
 *
 * The `retryable` flag classifies the failure: transient problems (network
 * errors, timeouts, 5xx responses) are retryable and consume a job retry
 * attempt; permanent failures (invalid credentials, rejected requests,
 * signature mismatches) are not and should abort the job immediately via
 * {@link toJobError}.
 */
export class IntegrationError extends QueueError {
  /**
   * @param message - Human-readable failure description (safe to log).
   * @param code - Machine-readable error code (e.g. `TELEBIRR_TOKEN`).
   * @param retryable - Whether retrying the operation may plausibly succeed.
   * @param cause - Optional underlying error.
   */
  constructor(
    message: string,
    code: string,
    public readonly retryable: boolean,
    cause?: unknown,
  ) {
    super(message, code, cause)
    this.name = 'IntegrationError'
  }
}

/**
 * Safely describe an unknown error for logging/error messages. Never throws
 * and never returns `undefined`.
 */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
