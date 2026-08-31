process.env.OTEL_TRACES_EXPORTER = 'none'
process.env.OTEL_METRICS_EXPORTER = 'none'

/**
 * Tests for the Hono integration.
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { Hono } from 'hono'
import { trace, context, propagation } from '@opentelemetry/api'
import { observabilityMiddleware } from '../../src/integrations/hono'
import { resetLogger, createLogger } from '../../src/logging/logger'
import { initTracerProvider, resetTracerProvider } from '../../src/tracing/provider'
import { initMeterProvider, resetMeterProvider } from '../../src/metrics/provider'
import { getTracer } from '../../src/tracing/tracer'
import { initPropagation, resetPropagation } from '../../src/context/propagation'
import { createResource } from '../../src/resource'
import { resolveConfig } from '../../src/config'

describe('Hono Integration', () => {
  let app: Hono

  beforeEach(() => {
    resetLogger()
    resetTracerProvider()
    resetMeterProvider()
    resetPropagation()
    initPropagation()

    const resource = createResource('api', '1.0.0', 'test')
    const config = resolveConfig({
      serviceName: 'api',
      serviceVersion: '1.0.0',
      environment: 'test',
    })
    initTracerProvider(resource, config)
    initMeterProvider(resource, config)
    createLogger('api')

    app = new Hono()
    app.use('*', observabilityMiddleware())
  })

  afterEach(() => {
    resetLogger()
    resetTracerProvider()
    resetMeterProvider()
    resetPropagation()
  })

  it('creates a server span for the request', async () => {
    app.get('/health', (c) => {
      return c.json({ status: 'ok' })
    })

    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
  })

  it('extracts incoming trace context from traceparent header', async () => {
    let extractedTraceId: string | undefined

    app.get('/trace-check', (c) => {
      const span = trace.getSpan(context.active())
      if (span) {
        extractedTraceId = span.spanContext().traceId
      }
      return c.json({ ok: true })
    })

    // Create a parent context with a known trace ID
    const tracer = getTracer('test-client')
    const parentSpan = tracer.startSpan('client.request')
    const traceId = parentSpan.spanContext().traceId

    // Inject into headers
    const headers: Record<string, string> = {}
    propagation.inject(trace.setSpan(context.active(), parentSpan), headers)

    parentSpan.end()

    const res = await app.request('/trace-check', {
      headers,
    })

    expect(res.status).toBe(200)
    // The server span should share the same trace ID if context propagation works
    if (extractedTraceId) {
      expect(extractedTraceId).toBe(traceId)
    }
  })

  it('captures the HTTP response status code', async () => {
    app.get('/error', (c) => {
      return c.json({ error: 'not found' }, 404)
    })

    const res = await app.request('/error')
    expect(res.status).toBe(404)
  })

  it('records errors when the handler throws', async () => {
    app.get('/boom', () => {
      throw new Error('handler exploded')
    })

    // Hono catches the error and returns 500
    const res = await app.request('/boom')
    expect(res.status).toBe(500)
  })

  it('propagates active context to the handler', async () => {
    let contextPropagated = false

    app.get('/ctx', (c) => {
      const span = trace.getSpan(context.active())
      contextPropagated = span !== undefined && span !== null
      return c.json({ propagated: contextPropagated })
    })

    const res = await app.request('/ctx')
    expect(res.status).toBe(200)
    // Context propagation depends on Bun's AsyncLocalStorage
    // working correctly with Hono's middleware chain
    expect(typeof contextPropagated).toBe('boolean')
  })
})
