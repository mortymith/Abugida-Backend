/**
 * @module shutdown
 *
 * Graceful shutdown for the worker process. On SIGTERM/SIGINT the worker stops
 * accepting new jobs, lets the in-flight jobs finish (BullMQ's `worker.close()`),
 * closes the health server and the Redis connections, and flushes telemetry.
 *
 * The order matters: the worker is stopped first so no new job starts while
 * the rest of the process is torn down.
 */

export interface ShutdownSteps {
  /** Stop the BullMQ worker (drains in-flight jobs). */
  stopWorker: () => Promise<void>
  /** Stop the health HTTP server. */
  stopHealthServer: () => Promise<void>
  /** Close the Redis connections used by the worker. */
  closeConnections: () => Promise<void>
  /** Flush and tear down the observability stack. */
  shutdownTelemetry: () => Promise<void>
  /** Report a shutdown step (used for logging). */
  log?: (message: string, err?: unknown) => void
  /** Called once the process is ready to exit. */
  onShutdownComplete?: () => void
}

/**
 * Install SIGTERM/SIGINT handlers that run the shutdown steps exactly once.
 *
 * @returns A function that removes the handlers again (used by tests).
 */
export function registerGracefulShutdown(steps: ShutdownSteps): () => void {
  let shuttingDown = false

  const ordered: Array<[string, () => Promise<void>]> = [
    ['stopWorker', steps.stopWorker],
    ['stopHealthServer', steps.stopHealthServer],
    ['closeConnections', steps.closeConnections],
    ['shutdownTelemetry', steps.shutdownTelemetry],
  ]

  const handler = (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true

    const run = async () => {
      // Run the steps in order; a failing step must not prevent the
      // remaining ones from running, otherwise a single error would leave
      // the Redis connections open.
      for (const [name, step] of ordered) {
        try {
          await step()
        } catch (err) {
          // Intentionally reported but not rethrown: shutdown must always
          // reach the exit.
          steps.log?.(`Failed to ${name} during shutdown`, err)
        }
      }
      steps.log?.(`Received ${signal} — shutdown complete`)
      steps.onShutdownComplete?.()
    }

    void run()
  }

  const onTerm = () => handler('SIGTERM')
  const onInt = () => handler('SIGINT')

  process.on('SIGTERM', onTerm)
  process.on('SIGINT', onInt)

  return () => {
    process.off('SIGTERM', onTerm)
    process.off('SIGINT', onInt)
  }
}
