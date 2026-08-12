/**
 * @example hono/worker
 * @description Example of running a queue worker alongside a Hono API
 * with health check routes.
 */

import { createHonoWorker, mergeWithDefaults } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const config = mergeWithDefaults({
  redis: {
    hostname: "localhost",
    port: 6379,
  },
  monitoring: { enabled: true },
  logging: { level: "info", format: "pretty" },
});

// ---------------------------------------------------------------------------
// Create Worker with Health Routes
// ---------------------------------------------------------------------------

const {
  app: healthApp,
  worker,
  start,
  stop,
} = createHonoWorker({
  config,
  enableHealthRoutes: true,
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function main() {
  console.log("[example:hono:worker] Starting worker with health check routes…");

  await start();

  console.log("[example:hono:worker] Worker is running!");
  console.log("Health check: GET http://localhost:3001/health/queue");
  console.log("Metrics:      GET http://localhost:3001/health/queue/metrics");
  console.log("Dashboard:    GET http://localhost:3001/health/queue/dashboard");

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("\n[example:hono:worker] Shutting down…");
    await stop();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("\n[example:hono:worker] Interrupted. Shutting down…");
    await stop();
    process.exit(0);
  });
}

// In a real app, you would also serve healthApp on a port:
// serve(healthApp, { port: 3001 });

console.log("[example:hono:worker] Worker example (not actually starting)");
console.log("In a real app, call main() to start the worker.");
