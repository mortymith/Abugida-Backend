/**
 * S3 client creation and lifecycle management.
 *
 * This module is the single source of truth for constructing the `S3Client`
 * instance used by all storage operations. It handles provider-specific
 * defaults, connection pooling, and Bun-optimised HTTP handlers.
 */

import { S3Client } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import type { StorageConfig } from './types.ts'
import { validateConfig, PROVIDER_DEFAULTS } from '../config/schema.ts'

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/**
 * Create an `S3Client` from a `StorageConfig`.
 *
 * The config is validated and defaults are applied before the client is
 * constructed. The client is configured with:
 * - Provider-specific `forcePathStyle` and endpoint
 * - Bun-optimised `NodeHttpHandler` with connection/socket timeouts
 * - Adaptive retry mode with configurable max attempts
 * - Optional S3 Transfer Acceleration
 * - Optional server-side encryption defaults
 *
 * @param config - Raw storage configuration.
 * @returns A ready-to-use `S3Client` instance.
 */
export function createClient(config: StorageConfig): S3Client {
  const resolved = validateConfig(config)
  const providerDefaults = PROVIDER_DEFAULTS[resolved.provider]

  const httpHandler = new NodeHttpHandler({
    connectionTimeout: resolved.connectionTimeout,
    socketTimeout: resolved.requestTimeout,
  })

  const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
    endpoint: resolved.endpoint || providerDefaults.defaultEndpoint || undefined,
    region: resolved.region,
    credentials: {
      accessKeyId: resolved.accessKeyId,
      secretAccessKey: resolved.secretAccessKey,
    },
    forcePathStyle: resolved.forcePathStyle,
    requestHandler: httpHandler,
    maxAttempts: resolved.maxAttempts,
    retryMode: resolved.retryStrategy?.backoff === 'adaptive' ? 'adaptive' : 'standard',
    useAccelerateEndpoint: resolved.useAccelerateEndpoint,
  }

  return new S3Client(clientConfig)
}

// ---------------------------------------------------------------------------
// Client cache (singleton per config fingerprint)
// ---------------------------------------------------------------------------

/** Simple in-memory cache to reuse clients with identical configuration. */
const clientCache = new Map<string, S3Client>()

/**
 * Create or retrieve a cached `S3Client` for the given config.
 *
 * The cache key is derived from the endpoint, region, bucket, and
 * access key ID. This avoids creating duplicate TCP connections when
 * the same config is passed repeatedly (e.g. in serverless cold starts).
 */
export function getOrCreateClient(config: StorageConfig): S3Client {
  const cacheKey = [config.endpoint, config.region, config.bucket, config.accessKeyId].join('|')

  const existing = clientCache.get(cacheKey)
  if (existing) return existing

  const client = createClient(config)
  clientCache.set(cacheKey, client)
  return client
}

/**
 * Destroy a cached client and remove it from the cache.
 * Useful for graceful shutdown or config rotation.
 */
export function destroyClient(config: StorageConfig): void {
  const cacheKey = [config.endpoint, config.region, config.bucket, config.accessKeyId].join('|')

  const client = clientCache.get(cacheKey)
  if (client) {
    client.destroy()
    clientCache.delete(cacheKey)
  }
}

/**
 * Destroy all cached clients. Call during process shutdown.
 */
export function destroyAllClients(): void {
  for (const client of clientCache.values()) {
    client.destroy()
  }
  clientCache.clear()
}
