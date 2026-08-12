/**
 * @module utils/retry
 * @description Retry strategies and utilities for job processing.
 * Provides configurable exponential/fixed backoff with jitter
 * and maximum attempt limits.
 */

// ---------------------------------------------------------------------------
// Backoff Calculator
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Maximum number of retry attempts (not including the initial attempt). Default: 3. */
  maxAttempts: number;
  /** Type of backoff strategy. Default: `"exponential"`. */
  type: "fixed" | "exponential";
  /** Base delay in milliseconds. Default: `1000`. */
  baseDelay: number;
  /** Maximum delay cap in milliseconds. Default: `30000`. */
  maxDelay: number;
  /** Whether to add jitter to prevent thundering herd. Default: `true`. */
  jitter: boolean;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  type: "exponential",
  baseDelay: 1000,
  maxDelay: 30_000,
  jitter: true,
};

/**
 * Calculate the delay in ms before the next retry.
 *
 * @param attempt - The attempt number (1-indexed, i.e., first retry = 1).
 * @param options - Retry configuration.
 */
export function calculateBackoff(attempt: number, options: Partial<RetryOptions> = {}): number {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let delay: number;

  if (opts.type === "exponential") {
    delay = opts.baseDelay * Math.pow(2, attempt - 1);
  } else {
    delay = opts.baseDelay;
  }

  // Add jitter (±25%) before capping so maxDelay is a hard upper bound
  if (opts.jitter) {
    const jitterRange = delay * 0.25;
    delay = delay - jitterRange + Math.random() * jitterRange * 2;
  }

  // Cap at max delay
  delay = Math.min(delay, opts.maxDelay);

  return Math.round(Math.max(0, delay));
}

/**
 * Execute a function with retry logic.
 *
 * @param fn - The async function to retry.
 * @param options - Retry configuration.
 * @returns The function result.
 * @throws The last error if all retries are exhausted.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: Partial<RetryOptions> = {}): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < opts.maxAttempts) {
        const delay = calculateBackoff(attempt + 1, opts);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Execute a function with retry and a condition check.
 * Retries only if `shouldRetry(error)` returns true.
 *
 * @param fn - The async function to retry.
 * @param shouldRetry - Predicate that determines if the error is retryable.
 * @param options - Retry configuration.
 */
export async function withConditionalRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < opts.maxAttempts && shouldRetry(error)) {
        const delay = calculateBackoff(attempt + 1, opts);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Common retryable error predicates.
 */
export const RetryPredicates = {
  /** Retry on connection-related errors. */
  isConnectionError: (err: unknown) =>
    err instanceof Error &&
    (err.message.includes("ECONNREFUSED") ||
      err.message.includes("ETIMEDOUT") ||
      err.message.includes("connection") ||
      err.message.includes("ECONNRESET")),

  /** Retry on timeout errors. */
  isTimeoutError: (err: unknown) =>
    err instanceof Error && (err.message.includes("timeout") || err.message.includes("ETIMEOUT")),

  /** Retry on transient (recoverable) errors. */
  isTransientError: (err: unknown) => RetryPredicates.isConnectionError(err) || RetryPredicates.isTimeoutError(err),
};
