/**
 * @example tanstack/worker
 * @description Example of running a queue worker in a TanStack Start
 * server entry point.
 */

import {
  createTanStackWorker,
  setupGracefulShutdown,
  mergeWithDefaults,
  getProcessorsForQueue,
} from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const config = mergeWithDefaults({
  redis: {
    hostname: "localhost",
    port: 6379,
  },
  logging: { level: "info", format: "pretty" },
});

// ---------------------------------------------------------------------------
// Options:
// - Use all processors: createTanStackWorker({ config })
// - Use selective processors: only process certain queues
// ---------------------------------------------------------------------------

// Option 1: All processors
// const worker = createTanStackWorker({ config });

// Option 2: Only statistics and audit processors (for a dashboard worker)
const selectiveProcessors = [...getProcessorsForQueue("abugida:statistics"), ...getProcessorsForQueue("abugida:audit")];

const worker = createTanStackWorker({
  config,
  processors: selectiveProcessors,
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function main() {
  console.log("[example:tanstack:worker] Starting TanStack Start worker…");

  setupGracefulShutdown(worker);

  await worker.start();

  console.log("[example:tanstack:worker] Worker is running!");
  console.log(
    "Processing queues:",
    selectiveProcessors.map((p) => p.queueName).filter((v, i, a) => a.indexOf(v) === i)
  );
}

console.log("[example:tanstack:worker] Worker example (not actually starting)");
console.log("In a real app, call main() in your entry-server.tsx.");
