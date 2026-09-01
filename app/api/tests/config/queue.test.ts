/**
 * @module queue.test
 * @description Unit tests for the queue configuration module.
 *
 * These tests verify the queue module's interface and exports.
 * The module builds queue config from appConfig at import time.
 */

import { describe, it, expect } from 'bun:test'

describe('queue module', () => {
  it('exports queueConfig object', async () => {
    const mod = await import('@/config/queue')
    expect(mod.queueConfig).toBeDefined()
    expect(typeof mod.queueConfig).toBe('object')
  })

  it('queueConfig has redis configuration', async () => {
    const mod = await import('@/config/queue')
    expect(mod.queueConfig.redis).toBeDefined()
    expect(mod.queueConfig.redis.hostname).toBeDefined()
    expect(typeof mod.queueConfig.redis.port).toBe('number')
  })

  it('queueConfig has logging configuration', async () => {
    const mod = await import('@/config/queue')
    expect(mod.queueConfig.logging).toBeDefined()
    expect(['debug', 'info', 'warn', 'error']).toContain(mod.queueConfig.logging.level)
    expect(['json', 'pretty']).toContain(mod.queueConfig.logging.format)
  })

  it('queueConfig has env field', async () => {
    const mod = await import('@/config/queue')
    expect(['development', 'staging', 'production']).toContain(mod.queueConfig.env)
  })

  it('exports createQueue function', async () => {
    const mod = await import('@/config/queue')
    expect(typeof mod.createQueue).toBe('function')
  })

  it('queueConfig.redis uses defaults from appConfig', async () => {
    const mod = await import('@/config/queue')
    // Default REDIS_HOST is localhost, REDIS_PORT is 6379
    expect(mod.queueConfig.redis.hostname).toBe('localhost')
    expect(mod.queueConfig.redis.port).toBe(6379)
  })
})
