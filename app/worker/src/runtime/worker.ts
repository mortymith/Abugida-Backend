/**
 * @module worker
 *
 * Worker runtime handle. Wraps the BullMQ consumer so the rest of the app
 * talks to a small, stable surface: start, stop, and the state the health
 * endpoint reports on.
 *
 * In this first cut the consumer itself still lives in `@abugida/queue`; the
 * runtime moves into this app together with the consumer half of the package
 * (ADR-028, PR B).
 */

import {
  createQueueWorker,
  type AnyProcessorEntry,
  type QueueConfig,
  type QueueWorker,
} from '@abugida/queue'

export interface WorkerHandle {
  /** Start the BullMQ workers for every selected queue. */
  start(): Promise<void>
  /** Stop the BullMQ workers, draining the in-flight jobs. */
  stop(): Promise<void>
  /** Whether the consumer is running. */
  isRunning(): boolean
  /** Queue names whose worker has been started. */
  activeQueues(): string[]
}

/**
 * Create a worker handle for the given configuration and processor entries.
 *
 * @param config - The resolved queue configuration.
 * @param processors - The processor entries for the selected queues.
 * @param queues - The queue names the processor entries belong to.
 */
export function createWorker(
  config: QueueConfig,
  processors: AnyProcessorEntry[],
  queues: string[],
): WorkerHandle {
  const worker: QueueWorker = createQueueWorker(config, processors)
  let active: string[] = []

  return {
    async start() {
      await worker.start()
      active = [...queues]
    },
    async stop() {
      await worker.stop()
      active = []
    },
    isRunning() {
      return worker.isRunning()
    },
    activeQueues() {
      return [...active]
    },
  }
}
