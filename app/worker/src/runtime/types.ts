/**
 * @module runtime/types
 * @description Consumer-side type vocabulary of the background worker.
 *
 * These types are the *worker half* of the split described in ADR-028: the
 * shared `@abugida/queue` package owns the job **contract** (`JobType`, the
 * payload interfaces, `JobDataMap`, `QueueClient`, the `QueueError`
 * hierarchy), while the types that describe *running* a job live here, in
 * the only process that runs jobs.
 *
 * Nothing in this module is exported from the shared package: a producer
 * never registers a processor, and a producer must not be able to depend on
 * the consumer runtime.
 */

import type { Processor } from 'bullmq'
import type { JobDataMap, JobType } from '@abugida/queue'
import type { JOB_QUEUE_MAP } from '@abugida/queue'

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

/**
 * The metadata BullMQ hands to a processor alongside the payload.
 */
export interface JobContext {
  id: string
  name: string
  attemptsMade: number
  timestamp: number
}

/**
 * A typed job processor function.
 *
 * `T` is the payload of the job type the processor handles. Receives the
 * payload and must return a result (or `void`).
 */
export type JobProcessor<T = unknown> = (data: T, job: JobContext) => Promise<unknown>

/**
 * A processor expressed the way BullMQ expects it.
 */
export type ProcessorAdapter = Processor

// ---------------------------------------------------------------------------
// Processor entries
// ---------------------------------------------------------------------------

/**
 * The name of the queue a job type is enqueued on, taken from the shared
 * contract (`JOB_QUEUE_MAP`).
 *
 * Because the map is declared `as const`, this resolves to the *literal*
 * queue name of `T` — so a processor registered for the wrong queue is a
 * compile error rather than a job that is never consumed (ADR-028 §5.2).
 */
export type QueueNameOf<T extends JobType> = (typeof JOB_QUEUE_MAP)[T]

/**
 * A registration of one job type: which processor handles it and on which
 * queue it lives.
 */
export interface ProcessorEntry<T extends JobType = JobType> {
  /** The job type this entry handles. */
  jobType: T
  /** The processor implementation. */
  processor: JobProcessor<JobDataMap[T]>
  /** The queue the job type belongs to — must match `JOB_QUEUE_MAP`. */
  queueName: QueueNameOf<T>
}

/**
 * One entry per job type.
 *
 * Used as the `satisfies` target of the processor aggregate: a missing job
 * type and a surplus job type are both compile errors, and each entry's
 * payload and queue name are checked against the shared contract.
 */
export type ProcessorEntries = { [T in JobType]: ProcessorEntry<T> }

/**
 * The union of every processor entry.
 *
 * Used where entries of different job types are handled together (the worker
 * runtime groups them per queue).
 */
export type AnyProcessorEntry = ProcessorEntries[JobType]

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

/**
 * The queue worker (consumer) — the handle the worker app uses to run and
 * stop the BullMQ workers.
 */
export interface QueueWorker {
  /** Start processing jobs. Resolves when every queue worker is ready. */
  start(): Promise<void>
  /** Gracefully stop the worker. Waits for in-flight jobs to finish. */
  stop(): Promise<void>
  /** Check whether the worker is currently running. */
  isRunning(): boolean
  /** Register a custom processor at runtime (before start). */
  registerProcessor(entry: AnyProcessorEntry): void
  /** The queues whose workers are currently running. */
  activeQueues(): string[]
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

/**
 * The record the worker stores under an idempotency key so a duplicated job
 * is not processed twice.
 */
export interface IdempotencyRecord {
  id: string
  jobType: JobType
  processedAt: Date
  result: unknown
  status: 'processing' | 'completed' | 'failed'
}
