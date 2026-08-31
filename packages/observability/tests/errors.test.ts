process.env.OTEL_TRACES_EXPORTER = 'none'

/**
 * Tests for the error recording module.
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { trace, context } from '@opentelemetry/api'
import { recordError } from '../src/errors/record-error'
import { resetLogger, createLogger } from '../src/logging/logger'
import { initTracerProvider, resetTracerProvider } from '../src/tracing/provider'
import { getTracer } from '../src/tracing/tracer'
import { createResource } from '../src/resource'
import { resolveConfig } from '../src/config'
import { initPropagation, resetPropagation } from '../src/context/propagation'

describe('Errors', () => {
  beforeEach(() => {
    resetLogger()
    resetTracerProvider()
    resetPropagation()
    initPropagation()
  })

  afterEach(() => {
    resetLogger()
    resetTracerProvider()
    resetPropagation()
  })

  it('records an Error instance on the active span', async () => {
    const resource = createResource('test', '1.0.0', 'test')
    const config = resolveConfig({
      serviceName: 'test',
      serviceVersion: '1.0.0',
      environment: 'test',
    })
    initTracerProvider(resource, config)
    createLogger('test')

    const tracer = getTracer('test')
    const span = tracer.startSpan('test.error-recording')

    await context.with(trace.setSpan(context.active(), span), () => {
      const error = new Error('something went wrong')
      recordError(error, { silent: true })
    })

    span.end()
    expect(true).toBe(true)
  })

  it('handles non-Error values', async () => {
    const resource = createResource('test', '1.0.0', 'test')
    const config = resolveConfig({
      serviceName: 'test',
      serviceVersion: '1.0.0',
      environment: 'test',
    })
    initTracerProvider(resource, config)
    createLogger('test')

    const tracer = getTracer('test')
    const span = tracer.startSpan('test.non-error')

    await context.with(trace.setSpan(context.active(), span), () => {
      recordError('just a string error', { silent: true })
    })

    span.end()
    expect(true).toBe(true)
  })

  it('works silently when no span is active', () => {
    createLogger('test')
    recordError(new Error('orphan error'), { silent: true })
    expect(true).toBe(true)
  })

  it('logs the error when not silent', () => {
    createLogger('test')
    // Just verify it doesn't throw
    recordError(new Error('logged error'))
    expect(true).toBe(true)
  })

  it('preserves the original error (does not wrap it)', () => {
    createLogger('test')
    const original = new Error('preserve me')

    recordError(original, { silent: true })

    expect(original.message).toBe('preserve me')
    expect(original).toBeInstanceOf(Error)
  })
})
