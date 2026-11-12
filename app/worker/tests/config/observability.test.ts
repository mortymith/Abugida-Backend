/**
 * @test config/observability
 * @description Unit tests for the worker's observability configuration module.
 *
 * These tests verify the observability module's interface and exports.
 * The module initializes observability from workerEnv at import time.
 */

import { describe, expect, test } from 'bun:test'

describe('observability module', () => {
  test('exports the observability config', async () => {
    const mod = await import('@/config/observability')
    expect(mod.observabilityConfig).toBeDefined()
    expect(typeof mod.observabilityConfig).toBe('object')
  })

  test('the config carries a service name and version', async () => {
    const mod = await import('@/config/observability')
    expect(typeof mod.observabilityConfig.serviceName).toBe('string')
    expect(typeof mod.observabilityConfig.serviceVersion).toBe('string')
    expect(typeof mod.observabilityConfig.environment).toBe('string')
  })

  test('exports init and shutdown functions', async () => {
    const mod = await import('@/config/observability')
    expect(typeof mod.init).toBe('function')
    expect(typeof mod.shutdown).toBe('function')
  })

  test('exports the shared logger', async () => {
    const mod = await import('@/config/observability')
    expect(mod.logger).toBeDefined()
    expect(typeof mod.logger).toBe('object')
  })
})
