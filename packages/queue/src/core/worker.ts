/**
 * @module core/worker
 * @description Queue worker (consumer) implementation. Creates BullMQ Worker
 * instances for each queue that has registered processors, handles graceful
 * shutdown, and exposes lifecycle events.
 */

import { Worker, type Processor } from "bullmq";
import type { QueueConfig } from "../config/schema.js";
import type { AnyProcessorEntry, QueueWorker } from "./types.js";
import { createBullMQConnection, closeConnection } from "./connection.js";
import { DEFAULT_QUEUE_OPTIONS } from "../definitions/queues.js";
import { getLogger } from "../monitoring/logger.js";
import { getWorkerId } from "../config/env.js";

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

interface ManagedWorker {
  worker: Worker;
  queueName: string;
  jobTypes: string[];
  isClosing: boolean;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Create a queue worker bound to the given configuration.
 *
 * @param config - Queue configuration.
 * @param processors - Array of processor entries to register.
 */
export function createQueueWorker(config: QueueConfig, processors: AnyProcessorEntry[] = []): QueueWorker {
  const logger = getLogger(config);
  const workers: ManagedWorker[] = [];
  let running = false;

  // Group processors by queue name
  const byQueue = new Map<string, AnyProcessorEntry[]>();
  for (const entry of processors) {
    const existing = byQueue.get(entry.queueName) ?? [];
    existing.push(entry);
    byQueue.set(entry.queueName, existing);
  }

  // -----------------------------------------------------------------------
  // Worker lifecycle
  // -----------------------------------------------------------------------

  async function start(): Promise<void> {
    if (running) return;

    logger.info("Starting queue worker", { workerId: getWorkerId() });

    for (const [queueName, entries] of byQueue) {
      const queueConfig = DEFAULT_QUEUE_OPTIONS[queueName];
      const userConfig = config.queues[queueName];
      const concurrency = userConfig?.concurrency ?? queueConfig?.concurrency ?? 5;

      const connection = createBullMQConnection(config, `consumer:${queueName}`);

      // Build a multi-job-type processor dispatcher
      const dispatchProcessor: Processor = async (job) => {
        const jobType = job.name;
        const matchingEntry = entries.find((e) => e.jobType === jobType);

        if (!matchingEntry) {
          logger.warn(`No processor registered for job type: ${jobType}`, {
            queueName,
            jobId: job.id,
          });
          throw new Error(`No processor for job type: ${jobType}`);
        }

        logger.debug(`Processing job`, {
          jobType,
          jobId: job.id,
          queueName,
          attemptsMade: job.attemptsMade,
        });

        const start = performance.now();
        try {
          const result = await matchingEntry.processor(job.data as never, {
            id: job.id ?? "",
            name: job.name,
            attemptsMade: job.attemptsMade,
            timestamp: job.timestamp,
          });
          const elapsed = performance.now() - start;

          logger.debug(`Job completed`, {
            jobType,
            jobId: job.id,
            queueName,
            processingTimeMs: Math.round(elapsed),
          });

          return result;
        } catch (error) {
          const elapsed = performance.now() - start;
          logger.error(`Job failed`, {
            jobType,
            jobId: job.id,
            queueName,
            attemptsMade: job.attemptsMade,
            processingTimeMs: Math.round(elapsed),
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      };

      const worker = new Worker(queueName, dispatchProcessor, {
        connection,
        concurrency,
        stalledInterval: userConfig?.stalledInterval ?? queueConfig?.stalledInterval ?? 30_000,
        // Use the queue's limiter if configured
        limiter: userConfig?.limiter ?? queueConfig?.limiter,
      });

      // Event handlers
      worker.on("completed", (job) => {
        logger.debug(`Worker completed job`, {
          queueName,
          jobType: job.name,
          jobId: job.id,
        });
      });

      worker.on("failed", (job, err) => {
        logger.error(`Worker failed job`, {
          queueName,
          jobType: job?.name,
          jobId: job?.id,
          error: err.message,
          stack: err.stack,
        });
      });

      worker.on("error", (err) => {
        logger.error(`Worker error on queue ${queueName}`, {
          error: err.message,
        });
      });

      worker.on("stalled", (jobId) => {
        logger.warn(`Job stalled`, { queueName, jobId });
      });

      workers.push({
        worker,
        queueName,
        jobTypes: entries.map((e) => e.jobType),
        isClosing: false,
      });

      logger.info(`Worker started for queue: ${queueName}`, {
        concurrency,
        jobTypes: entries.map((e) => e.jobType),
      });
    }

    running = true;
    logger.info("Queue worker ready", { workerId: getWorkerId() });
  }

  async function stop(): Promise<void> {
    if (!running) return;

    logger.info("Stopping queue worker…", { workerId: getWorkerId() });

    const closePromises = workers.map(async (mw) => {
      if (mw.isClosing) return;
      mw.isClosing = true;
      try {
        await mw.worker.close();
        logger.debug(`Worker closed for queue: ${mw.queueName}`);
      } catch (err) {
        logger.error(`Error closing worker for ${mw.queueName}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    await Promise.allSettled(closePromises);
    await closeConnection(config, "consumer");
    workers.length = 0;
    running = false;

    logger.info("Queue worker stopped", { workerId: getWorkerId() });
  }

  function isRunning(): boolean {
    return running;
  }

  function registerProcessor(entry: AnyProcessorEntry): void {
    if (running) {
      throw new Error(
        "Cannot register processors after the worker has started. Call registerProcessor() before start()."
      );
    }
    const existing = byQueue.get(entry.queueName) ?? [];
    existing.push(entry);
    byQueue.set(entry.queueName, existing);
  }

  return {
    start,
    stop,
    isRunning,
    registerProcessor,
  };
}
