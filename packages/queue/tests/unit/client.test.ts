/**
 * @test unit/client
 * @description Unit tests for the queue client.
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Mock BullMQ (before importing our modules)
// ---------------------------------------------------------------------------

const mockAdd = mock(() => ({
  id: "test-job-id",
  name: "PURCHASE_INITIATE",
}));

const mockAddBulk = mock(() => [{ id: "bulk-job-1" }, { id: "bulk-job-2" }]);

const mockGetJobCounts = mock(() =>
  Promise.resolve({
    waiting: 5,
    active: 2,
    completed: 100,
    failed: 3,
    delayed: 1,
  })
);

const mockClose = mock(() => Promise.resolve());

mock.module("bullmq", () => ({
  Queue: mock(() => ({
    add: mockAdd,
    addBulk: mockAddBulk,
    getJobCounts: mockGetJobCounts,
    close: mockClose,
  })),
  Worker: mock(() => ({})),
  createBunRedisClient: mock(() => ({ on: mock(() => {}) })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("QueueClient", () => {
  test("should export a createQueueClient factory", async () => {
    const { createQueueClient, mergeWithDefaults } = await import("../../src/core/client.js");
    const { mergeWithDefaults: mergeConfig } = await import("../../src/config/defaults.js");

    const config = mergeConfig({
      redis: { hostname: "localhost", port: 6379 },
    });

    expect(typeof createQueueClient).toBe("function");

    const client = createQueueClient(config);
    expect(client).toBeDefined();
    expect(typeof client.enqueue).toBe("function");
    expect(typeof client.enqueueBulk).toBe("function");
    expect(typeof client.getQueueLength).toBe("function");
    expect(typeof client.getJobCounts).toBe("function");
    expect(typeof client.close).toBe("function");
  });
});

describe("QueueConfig", () => {
  test("should merge defaults with user overrides", async () => {
    const { mergeWithDefaults } = await import("../../src/config/defaults.js");

    const config = mergeWithDefaults({
      redis: { hostname: "custom-redis", port: 6380 },
    });

    expect(config.redis.hostname).toBe("custom-redis");
    expect(config.redis.port).toBe(6380);
    expect(config.redis.tls).toBe(false);
    expect(config.monitoring.enabled).toBe(true);
    expect(config.logging.level).toBe("debug");
  });

  test("should detect environment from NODE_ENV", async () => {
    const origEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = "production";
    const { detectEnvironment } = await import("../../src/config/env.js");
    // Re-import to pick up the env change
    const env = detectEnvironment();
    expect(env).toBe("production");

    process.env.NODE_ENV = origEnv;
  });
});
