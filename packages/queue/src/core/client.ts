/**
 * @module core/client
 * @description Queue client (producer) implementation. Creates BullMQ Queue
 * instances on demand and exposes enqueue / bulk / stats methods.
 */

import { Queue, type JobsOptions } from "bullmq";
import type { QueueConfig } from "../config/schema.js";
import type { EnqueueOptions, JobDataMap, JobType, QueueClient } from "./types.js";
import { createBullMQConnection, closeConnection } from "./connection.js";
import { JOB_QUEUE_MAP, DEFAULT_QUEUE_OPTIONS, JOB_PRIORITY_MAP } from "../definitions/queues.js";

// ---------------------------------------------------------------------------
// QueueInstance cache
// ---------------------------------------------------------------------------

const queueCache = new Map<string, Queue>();

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Create a BullMQ Queue instance (or return cached) for the given queue name.
 */
function getOrCreateQueue(queueName: string, config: QueueConfig): Queue {
  const cached = queueCache.get(queueName);
  if (cached) return cached;

  const connection = createBullMQConnection(config, "producer");

  const queueDefaults = DEFAULT_QUEUE_OPTIONS[queueName];
  const userOverrides = config.queues[queueName];

  // Merge default + user options
  const mergedOptions: JobsOptions = {
    ...(queueDefaults?.defaultJobOptions as JobsOptions),
    ...(userOverrides?.defaultJobOptions as JobsOptions),
  };

  const queue = new Queue(queueName, {
    connection,
    defaultJobOptions: mergedOptions,
  });

  queueCache.set(queueName, queue);
  return queue;
}

/**
 * Build a BullMQ JobsOptions from our EnqueueOptions + queue defaults.
 */
function buildJobOptions(jobType: JobType, opts?: EnqueueOptions): JobsOptions {
  const base: JobsOptions = {};

  // Apply default priority from map
  const defaultPriority = JOB_PRIORITY_MAP[jobType];
  if (defaultPriority !== undefined) {
    base.priority = defaultPriority;
  }

  if (!opts) return base;

  if (opts.priority !== undefined) base.priority = opts.priority;
  if (opts.delay !== undefined) base.delay = opts.delay;
  if (opts.jobId !== undefined) base.jobId = opts.jobId;
  if (opts.removeOnComplete !== undefined) base.removeOnComplete = opts.removeOnComplete;
  if (opts.removeOnFail !== undefined) base.removeOnFail = opts.removeOnFail;
  if (opts.backoff !== undefined) base.backoff = opts.backoff;

  return base;
}

// ---------------------------------------------------------------------------
// QueueClient implementation
// ---------------------------------------------------------------------------

/**
 * Create a queue client bound to the given configuration.
 */
export function createQueueClient(config: QueueConfig): QueueClient {
  return {
    async enqueue<T extends JobType>(jobType: T, data: JobDataMap[T], opts?: EnqueueOptions): Promise<string> {
      const queueName = JOB_QUEUE_MAP[jobType];
      const queue = getOrCreateQueue(queueName, config);
      const jobOpts = buildJobOptions(jobType, opts);

      const job = await queue.add(jobType, data, jobOpts);
      return job.id ?? "";
    },

    async enqueueBulk<T extends JobType>(
      items: Array<{ jobType: T; data: JobDataMap[T]; opts?: EnqueueOptions }>
    ): Promise<string[]> {
      // Group items by queue name for efficient bulk adds
      const byQueue = new Map<string, Array<{ name: string; data: unknown; opts: JobsOptions }>>();

      for (const item of items) {
        const queueName = JOB_QUEUE_MAP[item.jobType];
        const jobs = byQueue.get(queueName) ?? [];
        jobs.push({
          name: item.jobType,
          data: item.data as unknown,
          opts: buildJobOptions(item.jobType, item.opts),
        });
        byQueue.set(queueName, jobs);
      }

      const allIds: string[] = [];

      for (const [queueName, jobs] of byQueue) {
        const queue = getOrCreateQueue(queueName, config);
        const added = await queue.addBulk(jobs);
        for (const j of added) {
          allIds.push(j.id ?? "");
        }
      }

      return allIds;
    },

    async getQueueLength(queueName: string): Promise<number> {
      const queue = getOrCreateQueue(queueName, config);
      const counts = await queue.getJobCounts("waiting", "active", "delayed");
      return (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
    },

    async getJobCounts(queueName: string): Promise<Record<string, number>> {
      const queue = getOrCreateQueue(queueName, config);
      return queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
    },

    async close(): Promise<void> {
      const promises = Array.from(queueCache.values()).map((q) =>
        q.close().catch(() => {
          /* ignore close errors */
        })
      );
      await Promise.allSettled(promises);
      queueCache.clear();
      await closeConnection(config, "producer");
    },
  };
}
