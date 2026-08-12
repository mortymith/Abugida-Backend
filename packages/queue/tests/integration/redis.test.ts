/**
 * @test integration/redis
 * @description Integration tests for Redis connection management.
 * These tests require a running Redis instance.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";

// Note: These tests require Redis running at localhost:6379
// Skip in CI if Redis is not available

const REDIS_AVAILABLE = false; // Set to false if no Redis

describe.skipIf(!REDIS_AVAILABLE)("Redis Connection Integration", () => {
  test("should create and cache connections", async () => {
    const { createConnection, closeConnection } = await import("../../src/core/connection.js");
    const { mergeWithDefaults } = await import("../../src/config/defaults.js");

    const config = mergeWithDefaults({
      redis: { hostname: "localhost", port: 6379 },
    });

    const conn1 = createConnection(config, "test-producer");
    const conn2 = createConnection(config, "test-producer");

    // Same purpose should return same cached connection
    expect(conn1).toBe(conn2);

    await closeConnection(config, "test-producer");
  });

  test("should check connection health", async () => {
    const { createConnection, checkConnectionHealth, closeConnection } = await import("../../src/core/connection.js");
    const { mergeWithDefaults } = await import("../../src/config/defaults.js");

    const config = mergeWithDefaults({
      redis: { hostname: "localhost", port: 6379 },
    });

    const conn = createConnection(config, "test-health");

    const health = await checkConnectionHealth(conn);
    expect(health.connected).toBe(true);
    expect(health.latencyMs).not.toBeNull();
    expect(health.latencyMs!).toBeLessThan(100);

    await closeConnection(config, "test-health");
  });
});
