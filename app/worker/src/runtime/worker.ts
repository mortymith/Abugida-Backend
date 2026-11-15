/**
 * @module runtime/worker
 * @description Queue worker (consumer) runtime.
 *
 * Creates one BullMQ `Worker` per queue that has registered processors,
 * dispatches each job to the processor registered for its job type, and
 * handles graceful shutdown.
 *
 * This is the consumer half of the queue split (ADR-028): it lives in the
 * worker app, which is the only process that runs jobs. The shared
 * `@abugida/queue` package keeps the producer runtime and the connection
 * helpers the worker borrows.
 */

import * as BullMQ from 'bullmq'
import type { JobType } from '@abugida/queue'
import type { QueueConfig } from '@abugida/queue'
import {
  closeConnection,
  createConnection,
  createBullMQConnection,
  DEFAULT_QUEUE_OPTIONS,
} from '@abugida/queue'
import type { RedisClient } from 'bun'

import { logger } from '@/config/observability'
import { getWorkerId } from '@/config/app_config'
import { classifyError, safeErrorMessage } from '@/utils/errors'
import { processWithIdempotency } from '@/utils/idempotency'

import { ProcessorRegistry } from './registry'
import type { AnyProcessorEntry, ProcessorAdapter, QueueWorker } from './types'

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

interface ManagedWorker {
  worker: BullMQ.Worker
  queueName: string
  jobTypes: string[]
  isClosing: boolean
}

/**
 * The raw Redis connection the idempotency layer uses. It is created lazily
 * on the first job that carries an `idempotencyKey` and failures are
 * non-fatal: idempotency is a protection layer, not a precondition for
 * processing, so a missing connection falls back to running the processor.
 */
function createIdempotencyConnection(config: QueueConfig): RedisClient | undefined {
  try {
    return createConnection(config, 'consumer:idempotency')
  } catch (err) {
    logger.warn(
      { err: safeErrorMessage(err) },
      'Idempotency store unavailable — jobs are processed without dedupe',
    )
    return undefined
  }
}

/**
 * Read the idempotency key off a job payload, if it carries one.
 */
function extractIdempotencyKey(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const key = (data as { idempotencyKey?: unknown }).idempotencyKey
  return typeof key === 'string' && key.length > 0 ? key : undefined
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Create a queue worker bound to the given configuration.
 *
 * @param config - Queue configuration.
 * @param processors - Processor entries to register.
 */
export function createQueueWorker(
  config: QueueConfig,
  processors: AnyProcessorEntry[] = [],
): QueueWorker {
  const workers: ManagedWorker[] = []
  const active: string[] = []
  let running = false
  let idempotencyRedis: RedisClient | undefined

  // The registry is the runtime view of the processor set: it answers
  // lookups by job type and groups the entries per queue.
  const registry = new ProcessorRegistry(processors)

  // -----------------------------------------------------------------------
  // Worker lifecycle
  // -----------------------------------------------------------------------

  async function start(): Promise<void> {
    if (running) return

    logger.info({ workerId: getWorkerId() }, 'Starting queue worker')

    for (const [queueName, entries] of registry.getByQueue()) {
      const queueConfig = DEFAULT_QUEUE_OPTIONS[queueName]
      const userConfig = config.queues[queueName]
      const concurrency = userConfig?.concurrency ?? queueConfig?.concurrency ?? 5

      const connection = createBullMQConnection(config, `consumer:${queueName}`)

      // Build a multi-job-type processor dispatcher
      const dispatchProcessor: ProcessorAdapter = async (job) => {
        const jobType = job.name
        const matchingEntry = registry.get(jobType as JobType)

        if (!matchingEntry) {
          logger.warn({ queueName, jobId: job.id, jobType }, 'No processor registered for job type')
          throw new Error(`No processor for job type: ${jobType}`)
        }

        logger.debug(
          { jobType, jobId: job.id, queueName, attemptsMade: job.attemptsMade },
          'Processing job',
        )

        const start = performance.now()
        try {
          // Every contract payload that addresses a domain entity carries an
          // idempotency key, so retries of the same job are deduped by it.
          // Jobs without a key are processed unconditionally.
          const idempotencyKey = extractIdempotencyKey(job.data)
          const context = {
            id: job.id ?? '',
            name: job.name,
            attemptsMade: job.attemptsMade,
            timestamp: job.timestamp,
          }
          const run = () => matchingEntry.processor(job.data as never, context)
          const redis =
            idempotencyKey === undefined
              ? undefined
              : (idempotencyRedis ??= createIdempotencyConnection(config))
          const result =
            idempotencyKey !== undefined && redis
              ? await processWithIdempotency(redis, idempotencyKey, jobType as JobType, run)
              : await run()
          const elapsed = performance.now() - start

          logger.debug(
            { jobType, jobId: job.id, queueName, processingTimeMs: Math.round(elapsed) },
            'Job completed',
          )

          return result
        } catch (error) {
          const elapsed = performance.now() - start
          logger.error(
            {
              jobType,
              jobId: job.id,
              queueName,
              attemptsMade: job.attemptsMade,
              processingTimeMs: Math.round(elapsed),
              category: classifyError(error),
              error: safeErrorMessage(error),
            },
            'Job failed',
          )
          throw error
        }
      }

      const limiter = userConfig?.limiter ?? queueConfig?.limiter

      const worker = new BullMQ.Worker(queueName, dispatchProcessor, {
        connection,
        concurrency,
        stalledInterval: userConfig?.stalledInterval ?? queueConfig?.stalledInterval ?? 30_000,
        ...(limiter ? { limiter } : {}),
      })

      // Event handlers
      worker.on('completed', (job) => {
        logger.debug({ queueName, jobType: job.name, jobId: job.id }, 'Worker completed job')
      })

      worker.on('failed', (job, err) => {
        logger.error(
          {
            queueName,
            jobType: job?.name,
            jobId: job?.id,
            category: classifyError(err),
            error: safeErrorMessage(err),
          },
          'Worker failed job',
        )
      })

      worker.on('error', (err) => {
        logger.error(
          { queueName, category: classifyError(err), error: safeErrorMessage(err) },
          'Worker error',
        )
      })

      worker.on('stalled', (jobId) => {
        logger.warn({ queueName, jobId }, 'Job stalled')
      })

      workers.push({
        worker,
        queueName,
        jobTypes: entries.map((e) => e.jobType),
        isClosing: false,
      })
      active.push(queueName)

      logger.info(
        { queueName, concurrency, jobTypes: entries.map((e) => e.jobType) },
        'Worker started for queue',
      )
    }

    running = true
    logger.info({ workerId: getWorkerId() }, 'Queue worker ready')
  }

  async function stop(): Promise<void> {
    if (!running) return

    logger.info({ workerId: getWorkerId() }, 'Stopping queue worker…')

    const closePromises = workers.map(async (mw) => {
      if (mw.isClosing) return
      mw.isClosing = true
      try {
        await mw.worker.close()
        logger.debug({ queueName: mw.queueName }, 'Worker closed for queue')
      } catch (err) {
        logger.error(
          { queueName: mw.queueName, error: err instanceof Error ? err.message : String(err) },
          'Error closing worker',
        )
      }
    })

    await Promise.allSettled(closePromises)
    await closeConnection(config, 'consumer')
    if (idempotencyRedis) {
      await closeConnection(config, 'consumer:idempotency')
      idempotencyRedis = undefined
    }
    workers.length = 0
    active.length = 0
    running = false

    logger.info({ workerId: getWorkerId() }, 'Queue worker stopped')
  }

  function isRunning(): boolean {
    return running
  }

  function registerProcessor(entry: AnyProcessorEntry): void {
    if (running) {
      throw new Error(
        'Cannot register processors after the worker has started. Call registerProcessor() before start().',
      )
    }
    registry.register(entry)
  }

  function activeQueues(): string[] {
    return [...active]
  }

  return {
    start,
    stop,
    isRunning,
    registerProcessor,
    activeQueues,
  }
}
