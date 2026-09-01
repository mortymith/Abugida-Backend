/**
 * @module config/index.test
 * @description Tests that the barrel export re-exports all expected symbols.
 */

import { describe, it, expect } from 'bun:test'

describe('config barrel exports', () => {
  it('re-exports appConfig and parseAppConfig from app_config', async () => {
    const mod = await import('@/config/index')
    expect(mod.appConfig).toBeDefined()
    expect(typeof mod.parseAppConfig).toBe('function')
  })

  it('re-exports databaseConfig from database', async () => {
    const mod = await import('@/config/index')
    expect(mod.databaseConfig).toBeDefined()
  })

  it('re-exports authConfig and createAuthInstance from auth', async () => {
    const mod = await import('@/config/index')
    expect(mod.authConfig).toBeDefined()
    expect(typeof mod.createAuthInstance).toBe('function')
  })

  it('re-exports queueConfig and createQueue from queue', async () => {
    const mod = await import('@/config/index')
    expect(mod.queueConfig).toBeDefined()
    expect(typeof mod.createQueue).toBe('function')
  })

  it('re-exports observabilityConfig, init, shutdown, logger from observability', async () => {
    const mod = await import('@/config/index')
    expect(mod.observabilityConfig).toBeDefined()
    expect(typeof mod.init).toBe('function')
    expect(typeof mod.shutdown).toBe('function')
    expect(mod.logger).toBeDefined()
  })

  it('re-exports rateLimitConfig, createRateLimiters, RateLimitExceededError from rate-limit', async () => {
    const mod = await import('@/config/index')
    expect(mod.rateLimitConfig).toBeDefined()
    expect(typeof mod.createRateLimiters).toBe('function')
    expect(typeof mod.RateLimitExceededError).toBe('function')
  })
})
