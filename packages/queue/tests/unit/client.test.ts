/**
 * @test unit/client
 * @description Unit tests for the queue client.
 */

import { describe, test, expect } from 'bun:test'
import { mockBullMQ } from '../helpers/bullmq-mock.js'

// ---------------------------------------------------------------------------
// Mock BullMQ (before importing our modules) — complete surface via the
// shared helper; see tests/helpers/bullmq-mock.ts for why it must be whole.
// ---------------------------------------------------------------------------

mockBullMQ()

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QueueClient', () => {
  test('should export a createQueueClient factory', async () => {
    const { createQueueClient, mergeWithDefaults } = await import('../../src/core/client.js')
    const { mergeWithDefaults: mergeConfig } = await import('../../src/config/defaults.js')

    const config = mergeConfig({
      redis: { hostname: 'localhost', port: 6379 },
    })

    expect(typeof createQueueClient).toBe('function')

    const client = createQueueClient(config)
    expect(client).toBeDefined()
    expect(typeof client.enqueue).toBe('function')
    expect(typeof client.enqueueBulk).toBe('function')
    expect(typeof client.getQueueLength).toBe('function')
    expect(typeof client.getJobCounts).toBe('function')
    expect(typeof client.close).toBe('function')
  })
})

describe('QueueConfig', () => {
  test('should merge defaults with user overrides', async () => {
    const { mergeWithDefaults } = await import('../../src/config/defaults.js')

    const config = mergeWithDefaults({
      redis: { hostname: 'custom-redis', port: 6380 },
    })

    expect(config.redis.hostname).toBe('custom-redis')
    expect(config.redis.port).toBe(6380)
    expect(config.redis.tls).toBe(false)
    expect(config.logging.level).toBe('debug')
  })

  test('should detect environment from NODE_ENV', async () => {
    const origEnv = process.env.NODE_ENV

    process.env.NODE_ENV = 'production'
    const { detectEnvironment } = await import('../../src/config/env.js')
    // Re-import to pick up the env change
    const env = detectEnvironment()
    expect(env).toBe('production')

    process.env.NODE_ENV = origEnv
  })
})
