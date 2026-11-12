/**
 * @module processors
 *
 * Queue selection for the worker. Turns the `WORKER_QUEUES` setting into the
 * concrete set of queues this worker instance consumes, plus the processor
 * entries registered for them.
 *
 * `WORKER_QUEUES` is either `all` (every declared queue) or a CSV of full
 * queue names (e.g. `abugida.purchases,abugida.webhooks`). The selective
 * capability that used to live in the shared package is an operational
 * feature of the worker app (ADR-028) — it is also the mechanism that gates a
 * per-queue rollout.
 */

import { allProcessors, getAllQueueNames, type AnyProcessorEntry } from '@abugida/queue'

/** Sentinel value of `WORKER_QUEUES` meaning "every declared queue". */
export const ALL_QUEUES = 'all'

export interface ProcessorSelection {
  /** The queue names this worker instance consumes. */
  queues: string[]
  /** The processor entries registered for those queues. */
  processors: AnyProcessorEntry[]
}

/**
 * Parse `WORKER_QUEUES` into the list of queue names to consume.
 *
 * @throws {Error} When a queue name is not a declared queue — a typo would
 *   otherwise start a worker that silently consumes nothing.
 */
export function parseQueueSelection(spec: string): string[] {
  const trimmed = spec.trim()
  if (trimmed.length === 0) {
    throw new Error('WORKER_QUEUES must not be empty. Use "all" or a comma-separated queue list.')
  }

  if (trimmed.toLowerCase() === ALL_QUEUES) {
    return getAllQueueNames()
  }

  const known = new Set(getAllQueueNames())
  const queues = trimmed
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0)

  if (queues.length === 0) {
    throw new Error(`WORKER_QUEUES ("${spec}") does not name a single queue.`)
  }

  const unknown = queues.filter((name) => !known.has(name))
  if (unknown.length > 0) {
    throw new Error(
      `WORKER_QUEUES contains unknown queue(s): ${unknown.join(', ')}. ` +
        `Known queues: ${getAllQueueNames().join(', ')}.`,
    )
  }

  return [...new Set(queues)]
}

/**
 * Select the queues and processor entries for a `WORKER_QUEUES` setting.
 */
export function selectProcessors(spec: string): ProcessorSelection {
  const queues = parseQueueSelection(spec)
  const processors = allProcessors.filter((entry) => queues.includes(entry.queueName))

  return { queues, processors }
}
