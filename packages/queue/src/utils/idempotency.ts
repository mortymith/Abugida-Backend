/**
 * @module utils/idempotency
 * @description Idempotency helpers that prevent duplicate job processing.
 * Uses Redis SET NX EX for lock acquisition and stores processing results
 * for a configurable TTL.
 */

import type { RedisClient } from "bun";
import type { IdempotencyRecord, JobType } from "../core/types.js";
import { DuplicateJobError } from "../core/types.js";

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

const KEY_PREFIX = "abugida:idempotency";
const PROCESSING_TTL_SECONDS = 300; // 5 minutes lock TTL
const RESULT_TTL_SECONDS = 86_400; // 24 hours result TTL

function idempotencyKey(key: string): string {
  return `${KEY_PREFIX}:${key}`;
}

function processingKey(key: string): string {
  return `${KEY_PREFIX}:processing:${key}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if a job with the given idempotency key has already been processed.
 *
 * @returns The stored result if the job was already processed, or `null` if not.
 */
export async function checkIdempotency(redis: RedisClient, key: string): Promise<IdempotencyRecord | null> {
  const raw = await redis.get(idempotencyKey(key));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IdempotencyRecord;
  } catch {
    return null;
  }
}

/**
 * Acquire a processing lock for the given idempotency key.
 * Uses SET NX EX to atomically claim the lock.
 *
 * @returns `true` if the lock was acquired (first time processing).
 * @throws {DuplicateJobError} if the job was already processed.
 */
export async function acquireProcessingLock(
  redis: RedisClient,
  idempotencyKeyStr: string,
  jobType: JobType
): Promise<boolean> {
  // Check if already completed
  const existing = await checkIdempotency(redis, idempotencyKeyStr);
  if (existing && existing.status === "completed") {
    throw new DuplicateJobError(idempotencyKeyStr, jobType);
  }

  // Try to acquire processing lock
  const setResult = await redis.set(
    processingKey(idempotencyKeyStr),
    JSON.stringify({
      status: "processing",
      startedAt: new Date().toISOString(),
    }),
    "EX",
    String(PROCESSING_TTL_SECONDS),
    "NX"
  );

  if (setResult !== "OK") {
    // Another worker is already processing this job
    throw new DuplicateJobError(idempotencyKeyStr, jobType);
  }

  return true;
}

/**
 * Store the result of a successfully processed job.
 */
export async function storeIdempotencyResult(
  redis: RedisClient,
  idempotencyKeyStr: string,
  jobType: JobType,
  result: unknown
): Promise<void> {
  const record: IdempotencyRecord = {
    id: idempotencyKeyStr,
    jobType,
    processedAt: new Date(),
    result,
    status: "completed",
  };

  // Store result with TTL
  await redis.set(idempotencyKey(idempotencyKeyStr), JSON.stringify(record), "EX", RESULT_TTL_SECONDS);

  // Remove processing lock
  await redis.del(processingKey(idempotencyKeyStr));
}

/**
 * Mark a job as failed in the idempotency store (removes the processing lock
 * so the job can be retried by the next attempt).
 */
export async function markProcessingFailed(redis: RedisClient, idempotencyKeyStr: string): Promise<void> {
  await redis.del(processingKey(idempotencyKeyStr));
}

/**
 * Process a job with idempotency guarantees.
 * If the job was already processed, returns the stored result.
 * Otherwise runs the processor and stores the result.
 */
export async function processWithIdempotency<T>(
  redis: RedisClient,
  idempotencyKeyStr: string,
  jobType: JobType,
  processor: () => Promise<T>
): Promise<T> {
  // Check if already processed
  const existing = await checkIdempotency(redis, idempotencyKeyStr);
  if (existing && existing.status === "completed") {
    return existing.result as T;
  }

  // Acquire lock
  await acquireProcessingLock(redis, idempotencyKeyStr, jobType);

  try {
    const result = await processor();
    await storeIdempotencyResult(redis, idempotencyKeyStr, jobType, result);
    return result;
  } catch (error) {
    await markProcessingFailed(redis, idempotencyKeyStr);
    throw error;
  }
}
