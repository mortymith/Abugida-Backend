/**
 * @module core/connection
 * @description Redis connection management using Bun's native Redis client.
 * Raw {@link RedisClient} instances are created and cached per purpose, and
 * {@link createBullMQConnection} wraps them for BullMQ via
 * `createBunRedisClient`, so no ioredis is required.
 *
 * TLS, reconnect behavior, and connection pooling are all configurable through
 * {@link QueueConfig.redis}.
 */

import { RedisClient, type RedisOptions } from "bun";
import { createBunRedisClient, type IRedisClient } from "bullmq";
import type { QueueConfig, RedisConfig } from "../config/schema.js";
import type { QueueHealthStatus } from "./types.js";

// ---------------------------------------------------------------------------
// Connection Cache
// ---------------------------------------------------------------------------

interface CachedConnection {
  raw: RedisClient;
  adapter: IRedisClient;
}

const connectionCache = new Map<string, CachedConnection>();

// ---------------------------------------------------------------------------
// Connection Construction
// ---------------------------------------------------------------------------

/**
 * Build a `redis://` or `rediss://` URL from the Redis configuration.
 */
function buildRedisUrl(redis: RedisConfig): string {
  const scheme = redis.tls ? "rediss" : "redis";
  const auth = redis.password ? `:${encodeURIComponent(redis.password)}@` : "";
  const db = redis.db != null ? `/${redis.db}` : "";
  return `${scheme}://${auth}${redis.hostname}:${redis.port}${db}`;
}

/**
 * Map {@link RedisConfig} onto Bun's {@link RedisOptions}.
 * Only explicitly configured values are forwarded.
 */
function buildRedisOptions(config: QueueConfig): RedisOptions {
  const options: RedisOptions = {};

  if (config.redis.connectionTimeout !== undefined) {
    options.connectionTimeout = config.redis.connectionTimeout;
  }
  if (config.redis.autoReconnect !== undefined) {
    options.autoReconnect = config.redis.autoReconnect;
  }
  if (config.redis.maxRetries !== undefined) {
    options.maxRetries = config.redis.maxRetries;
  }
  if (config.redis.enableOfflineQueue !== undefined) {
    options.enableOfflineQueue = config.redis.enableOfflineQueue;
  }
  if (config.redis.enableAutoPipelining !== undefined) {
    options.enableAutoPipelining = config.redis.enableAutoPipelining;
  }
  if (config.redis.tls) {
    options.tls = true;
  }

  return options;
}

function createRedisEntry(config: QueueConfig, cacheKey: string): CachedConnection {
  const url = buildRedisUrl(config.redis);
  // Bun's RedisClient does not expose the URL it was constructed with, but
  // BullMQ's adapter recreates the raw client from `raw.url` when reconnecting
  // or duplicating. Attach it so reconnects preserve the configured endpoint.
  const raw = new RedisClient(url, buildRedisOptions(config)) as RedisClient & { url?: string };
  raw.url = url;

  const adapter = createBunRedisClient(raw, { lazyConnect: true });

  adapter.on("error", (err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[queue:connection] Redis error for ${cacheKey} – ${message}`);
  });

  return { raw, adapter };
}

function getCacheKey(config: QueueConfig, purpose: string): string {
  return `${purpose}@${config.redis.hostname}:${config.redis.port}:${config.redis.db ?? 0}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create (or retrieve from cache) a raw Bun {@link RedisClient} suitable for
 * direct Redis use (idempotency, metrics) or for wrapping with
 * {@link createBullMQConnection}.
 *
 * @param config - The full queue configuration (redis section is used).
 * @param purpose - A short label like `"producer"` or `"consumer:webhook"`
 *                  used to namespace the connection in the cache.
 */
export function createConnection(config: QueueConfig, purpose: string = "default"): RedisClient {
  const cacheKey = getCacheKey(config, purpose);

  const existing = connectionCache.get(cacheKey);
  if (existing) return existing.raw;

  const entry = createRedisEntry(config, cacheKey);
  connectionCache.set(cacheKey, entry);

  return entry.raw;
}

/**
 * Create (or retrieve from cache) a BullMQ-compatible connection backed by a
 * raw Bun {@link RedisClient}, using BullMQ's `createBunRedisClient` adapter.
 * Pass the result to `Queue` / `Worker` `connection` options.
 *
 * @param config - The full queue configuration (redis section is used).
 * @param purpose - A short label used to namespace the connection in the cache.
 */
export function createBullMQConnection(config: QueueConfig, purpose: string = "default"): IRedisClient {
  const cacheKey = getCacheKey(config, purpose);

  const existing = connectionCache.get(cacheKey);
  if (existing) return existing.adapter;

  const entry = createRedisEntry(config, cacheKey);
  connectionCache.set(cacheKey, entry);

  return entry.adapter;
}

/**
 * Check the health of a raw Redis connection.
 * Returns latency in ms or `null` if the connection is down.
 */
export async function checkConnectionHealth(
  connection: RedisClient
): Promise<{ connected: boolean; latencyMs: number | null }> {
  try {
    const start = performance.now();
    await connection.ping();
    const latency = performance.now() - start;
    return { connected: true, latencyMs: Math.round(latency * 100) / 100 };
  } catch {
    return { connected: false, latencyMs: null };
  }
}

/**
 * Close a specific connection and remove it from the cache.
 */
export async function closeConnection(config: QueueConfig, purpose: string = "default"): Promise<void> {
  const cacheKey = getCacheKey(config, purpose);
  const entry = connectionCache.get(cacheKey);
  if (entry) {
    await entry.adapter.quit();
    connectionCache.delete(cacheKey);
  }
}

/**
 * Close ALL cached connections.
 */
export async function closeAllConnections(): Promise<void> {
  const promises = Array.from(connectionCache.values()).map((entry) =>
    entry.adapter.quit().catch(() => {
      /* ignore close errors */
    })
  );
  await Promise.allSettled(promises);
  connectionCache.clear();
}

/**
 * Derive a simple health status string from connection state and queue depth.
 */
export function deriveHealthStatus(connected: boolean, failedCount: number, delayedCount: number): QueueHealthStatus {
  if (!connected) return "unhealthy";
  if (failedCount > 100 || delayedCount > 500) return "degraded";
  return "healthy";
}
