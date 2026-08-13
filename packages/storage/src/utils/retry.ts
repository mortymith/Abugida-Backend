/**
 * Retry strategies with configurable backoff.
 */

import type { BackoffStrategy } from '../core/types.ts'

export interface RetryOptions {
  /** Maximum number of retry attempts. */
  maxAttempts: number
  /** Backoff algorithm. */
  backoff: BackoffStrategy
  /** Base delay in ms. */
  baseDelay?: number
  /** Maximum delay cap in ms. */
  maxDelay?: number
  /** Predicate that decides whether an error is retryable. */
  retryable?: (error: unknown) => boolean
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  backoff: 'adaptive',
  baseDelay: 200,
  maxDelay: 10_000,
  retryable: () => true,
}

/**
 * Calculate the delay before the next retry attempt.
 */
export function calculateDelay(
  attempt: number,
  backoff: BackoffStrategy,
  baseDelay: number,
  maxDelay: number,
): number {
  switch (backoff) {
    case 'exponential': {
      const delay = baseDelay * Math.pow(2, attempt)
      return Math.min(delay, maxDelay)
    }
    case 'fixed':
      return baseDelay
    case 'adaptive': {
      // Exponential with jitter
      const exp = baseDelay * Math.pow(2, attempt)
      const jitter = Math.random() * baseDelay
      return Math.min(exp + jitter, maxDelay)
    }
  }
}

/**
 * Execute `fn` with automatic retries on failure.
 *
 * @param fn - The async operation to perform.
 * @param options - Retry configuration.
 * @returns The result of `fn` on success.
 * @throws The last error when all attempts are exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: unknown

  for (let attempt = 0; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry if this was the last attempt or the error is not retryable
      if (attempt === opts.maxAttempts || !opts.retryable(error)) {
        throw error
      }

      const delay = calculateDelay(attempt, opts.backoff, opts.baseDelay, opts.maxDelay)
      await sleep(delay)
    }
  }

  throw lastError
}

/** Simple sleep utility. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
