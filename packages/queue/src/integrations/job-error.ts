/**
 * @module integrations/job-error
 * @description Maps processor errors onto BullMQ error semantics. Permanent
 * integration failures become `UnrecoverableError` so the worker skips the
 * remaining retry attempts instead of burning them on a failure that cannot
 * succeed (invalid credentials, rejected requests, signature mismatches…).
 */

import { UnrecoverableError } from 'bullmq'
import { IntegrationError } from './errors.js'

/**
 * Normalize an error thrown inside a processor into the error that should
 * propagate to BullMQ:
 * - non-retryable {@link IntegrationError}s → `UnrecoverableError` (no more retries),
 * - unknown throwables → `Error`,
 * - everything else passes through unchanged.
 */
export function toJobError(error: unknown): Error {
  if (error instanceof IntegrationError && !error.retryable) {
    return new UnrecoverableError(`${error.name}[${error.code}]: ${error.message}`)
  }
  if (error instanceof Error) return error
  return new Error(String(error))
}
