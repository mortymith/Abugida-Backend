/**
 * @test unit/worker
 * @description Unit tests for the queue worker.
 */

import { describe, test, expect, mock } from "bun:test";
import type { ProcessorEntry } from "../../src/core/types.js";

mock.module("bullmq", () => ({
  Queue: mock(() => ({
    add: mock(() => ({ id: "test" })),
    getJobCounts: mock(() => Promise.resolve({})),
    close: mock(() => Promise.resolve()),
  })),
  Worker: mock(() => ({
    on: mock(() => {}),
    close: mock(() => Promise.resolve()),
  })),
  createBunRedisClient: mock(() => ({ on: mock(() => {}) })),
}));

describe("QueueWorker", () => {
  test("should export a createQueueWorker factory", async () => {
    const { createQueueWorker } = await import("../../src/core/worker.js");
    const { mergeWithDefaults } = await import("../../src/config/defaults.js");
    const { JobType } = await import("../../src/core/types.js");
    const { QUEUE_NAMES } = await import("../../src/definitions/queues.js");

    const config = mergeWithDefaults({
      redis: { hostname: "localhost", port: 6379 },
    });

    const mockProcessor = mock(async () => ({ ok: true }));

    const processors: ProcessorEntry[] = [
      {
        jobType: JobType.PURCHASE_INITIATE,
        processor: mockProcessor,
        queueName: QUEUE_NAMES.PURCHASES,
        concurrency: 3,
      },
    ];

    const worker = createQueueWorker(config, processors);
    expect(worker).toBeDefined();
    expect(typeof worker.start).toBe("function");
    expect(typeof worker.stop).toBe("function");
    expect(typeof worker.isRunning).toBe("function");
    expect(typeof worker.registerProcessor).toBe("function");
    expect(worker.isRunning()).toBe(false);
  });

  test("should not allow registering processors after start", async () => {
    const { createQueueWorker } = await import("../../src/core/worker.js");
    const { mergeWithDefaults } = await import("../../src/config/defaults.js");
    const { JobType } = await import("../../src/core/types.js");
    const { QUEUE_NAMES } = await import("../../src/definitions/queues.js");

    const config = mergeWithDefaults({
      redis: { hostname: "localhost", port: 6379 },
    });

    const mockProcessor = mock(async () => ({ ok: true }));

    const worker = createQueueWorker(config, [
      {
        jobType: JobType.PURCHASE_INITIATE,
        processor: mockProcessor,
        queueName: QUEUE_NAMES.PURCHASES,
        concurrency: 3,
      },
    ]);

    // Starting is mocked so it won't actually connect
    await worker.start();

    expect(() => {
      worker.registerProcessor({
        jobType: JobType.AUDIT_LOG,
        processor: mockProcessor,
        queueName: QUEUE_NAMES.AUDIT,
        concurrency: 1,
      });
    }).toThrow("Cannot register processors after the worker has started");

    await worker.stop();
  });
});
