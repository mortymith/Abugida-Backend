process.env.OTEL_TRACES_EXPORTER = 'none'
process.env.OTEL_METRICS_EXPORTER = 'none'

/**
 * Tests for initialization and idempotency.
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { initObservability, shutdownObservability, logger } from '../src/index'
import { resetLogger } from '../src/logging/logger'
import { resetTracerProvider } from '../src/tracing/provider'
import { resetMeterProvider } from '../src/metrics/provider'
import { resetPropagation } from '../src/context/propagation'

describe('Initialization', () => {
  beforeEach(() => {
    resetLogger()
    resetTracerProvider()
    resetMeterProvider()
    resetPropagation()
  })

  afterEach(async () => {
    try {
      await shutdownObservability()
    } catch {
      // Ignore shutdown errors in tests (ECONNREFUSED)
    }
    resetLogger()
    resetTracerProvider()
    resetMeterProvider()
    resetPropagation()
  })

  it('initialises without error', async () => {
    const result = await initObservability({
      serviceName: 'api',
      serviceVersion: '1.0.0',
      environment: 'test',
    })
    expect(result).toBeUndefined()
  })

  it('is idempotent — calling twice does not throw', async () => {
    await initObservability({
      serviceName: 'api',
      serviceVersion: '1.0.0',
      environment: 'test',
    })
    await initObservability({
      serviceName: 'api',
      serviceVersion: '1.0.0',
      environment: 'test',
    })
    expect(true).toBe(true)
  })

  it('provides a usable logger after initialisation', async () => {
    await initObservability({
      serviceName: 'api',
      serviceVersion: '1.0.0',
      environment: 'test',
    })

    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    logger.info({ test: true }, 'init test passed')
  })

  it('shutdown completes without error', async () => {
    await initObservability({
      serviceName: 'api',
      serviceVersion: '1.0.0',
      environment: 'test',
    })

    const result = await shutdownObservability()
    expect(result).toBeUndefined()
  })

  it('shutdown is safe when never initialised', async () => {
    const result = await shutdownObservability()
    expect(result).toBeUndefined()
  })
})
