/**
 * @module runtime/registry
 * @description Runtime registry of processor entries.
 *
 * The registry is the *runtime* view of the processor aggregate
 * ({@link ./processors.ts}): it stores the entries, answers lookups by job
 * type, and groups them per queue so the worker runtime can start one BullMQ
 * worker per queue.
 *
 * The compile-time guarantee that every job type has exactly one processor
 * (and that its queue matches the shared contract) lives in the aggregate's
 * `satisfies` clause — this class only has to be correct at runtime.
 */

import type { JobType } from '@abugida/queue'

import type { AnyProcessorEntry } from './types'

export class ProcessorRegistry {
  private readonly entries = new Map<JobType, AnyProcessorEntry>()

  constructor(entries: AnyProcessorEntry[] = []) {
    this.registerAll(entries)
  }

  /** Register a single processor entry. */
  register(entry: AnyProcessorEntry): void {
    this.entries.set(entry.jobType, entry)
  }

  /** Register multiple processor entries at once. */
  registerAll(entries: AnyProcessorEntry[]): void {
    for (const entry of entries) {
      this.register(entry)
    }
  }

  /** Get a processor entry by job type, or undefined if not registered. */
  get(jobType: JobType): AnyProcessorEntry | undefined {
    return this.entries.get(jobType)
  }

  /** Get all registered entries. */
  getAll(): AnyProcessorEntry[] {
    return Array.from(this.entries.values())
  }

  /** Check if a processor is registered for the given job type. */
  has(jobType: JobType): boolean {
    return this.entries.has(jobType)
  }

  /** Get all registered job types. */
  getJobTypes(): JobType[] {
    return Array.from(this.entries.keys())
  }

  /** Group entries by queue name (used by the worker setup). */
  getByQueue(): Map<string, AnyProcessorEntry[]> {
    const map = new Map<string, AnyProcessorEntry[]>()
    for (const entry of this.entries.values()) {
      const existing = map.get(entry.queueName) ?? []
      existing.push(entry)
      map.set(entry.queueName, existing)
    }
    return map
  }
}
