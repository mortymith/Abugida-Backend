/**
 * @module observability.test
 * @description Unit tests for the observability configuration module.
 *
 * These tests verify the observability module's interface and exports.
 * The module initializes observability from appConfig at import time.
 */

import { describe, it, expect } from 'bun:test'

describe('observability module', () => {
  it('exports observabilityConfig object', async () => {
    const mod = await import('@/config/observability')
    expect(mod.observabilityConfig).toBeDefined()
    expect(typeof mod.observabilityConfig).toBe('object')
  })

  it('observabilityConfig has serviceName', async () => {
    const mod = await import('@/config/observability')
    expect(mod.observabilityConfig.serviceName).toBeDefined()
    expect(typeof mod.observabilityConfig.serviceName).toBe('string')
  })

  it('observabilityConfig has serviceVersion', async () => {
    const mod = await import('@/config/observability')
    expect(mod.observabilityConfig.serviceVersion).toBeDefined()
    expect(typeof mod.observabilityConfig.serviceVersion).toBe('string')
  })

  it('observabilityConfig has environment', async () => {
    const mod = await import('@/config/observability')
    expect(mod.observabilityConfig.environment).toBeDefined()
    expect(typeof mod.observabilityConfig.environment).toBe('string')
  })

  it('observabilityConfig is a plain object', async () => {
    const mod = await import('@/config/observability')
    expect(typeof mod.observabilityConfig).toBe('object')
    expect(mod.observabilityConfig).not.toBeNull()
  })

  it('exports init function', async () => {
    const mod = await import('@/config/observability')
    expect(typeof mod.init).toBe('function')
  })

  it('exports shutdown function', async () => {
    const mod = await import('@/config/observability')
    expect(typeof mod.shutdown).toBe('function')
  })

  it('exports logger object', async () => {
    const mod = await import('@/config/observability')
    expect(mod.logger).toBeDefined()
    expect(typeof mod.logger).toBe('object')
  })

  it('logger is exported from the module', async () => {
    const mod = await import('@/config/observability')
    // logger is a getter that requires initObservability() to be called first
    // We just verify the export exists
    expect('logger' in mod).toBe(true)
  })
})
