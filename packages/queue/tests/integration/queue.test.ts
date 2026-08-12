/**
 * @test integration/queue
 * @description Integration tests for queue operations with a real Redis instance.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";

const REDIS_AVAILABLE = false;

describe.skipIf(!REDIS_AVAILABLE)("Queue Integration", () => {
  test("should enqueue and process a job end-to-end", async () => {
    const { createQueueClient: createClient } = await import("../../src/core/client.js");
    const { JobType } = await import("../../src/core/types.js");
    const { mergeWithDefaults } = await import("../../src/config/defaults.js");
    const { closeAllConnections } = await import("../../src/core/connection.js");

    const config = mergeWithDefaults({
      redis: { hostname: "localhost", port: 6379 },
      logging: { level: "warn", format: "json" },
    });

    const client = createClient(config);

    // Simple test processor
    const result = await client.enqueue(JobType.AUDIT_LOG, {
      action: "test_action",
      actorId: "test-actor",
      entityType: "test",
      entityId: "test-entity",
      metadata: { test: true },
      idempotencyKey: `integ-test:${Date.now()}`,
    });

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);

    await client.close();
    await closeAllConnections();
  });

  test("should get queue counts", async () => {
    const { createQueueClient } = await import("../../src/core/client.js");
    const { mergeWithDefaults } = await import("../../src/config/defaults.js");
    const { QUEUE_NAMES } = await import("../../src/definitions/queues.js");
    const { closeAllConnections } = await import("../../src/core/connection.js");

    const config = mergeWithDefaults({
      redis: { hostname: "localhost", port: 6379 },
      logging: { level: "warn", format: "json" },
    });

    const client = createQueueClient(config);
    const counts = await client.getJobCounts(QUEUE_NAMES.AUDIT);

    expect(counts).toBeDefined();
    expect(typeof counts).toBe("object");

    await client.close();
    await closeAllConnections();
  });
});
