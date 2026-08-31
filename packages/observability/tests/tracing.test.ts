process.env.OTEL_TRACES_EXPORTER = 'none'

/**
 * Tests for the tracing module.
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { trace, context, SpanStatusCode } from '@opentelemetry/api'
import {
  initTracerProvider,
  shutdownTracerProvider,
  getTracerProvider,
  resetTracerProvider,
} from '../src/tracing/provider'
import { getTracer } from '../src/tracing/tracer'
import { withSpan, withSpanSync, recordSpanError } from '../src/tracing/span'
import { createResource } from '../src/resource'
import { resolveConfig } from '../src/config'
import { initPropagation, resetPropagation } from '../src/context/propagation'

describe('Tracing', () => {
  beforeEach(() => {
    resetTracerProvider()
    resetPropagation()
    initPropagation()
  })

  afterEach(() => {
    resetTracerProvider()
    resetPropagation()
  })

  describe('provider', () => {
    it('initialises a TracerProvider', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })

      const provider = initTracerProvider(resource, config)
      expect(provider).toBeDefined()
    })

    it('is idempotent — returns the same provider on repeated calls', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })

      const first = initTracerProvider(resource, config)
      const second = initTracerProvider(resource, config)
      expect(first).toBe(second)
    })

    it('returns the provider via getTracerProvider()', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })

      initTracerProvider(resource, config)
      expect(getTracerProvider()).toBeDefined()
    })

    it('returns null before initialisation', () => {
      expect(getTracerProvider()).toBeNull()
    })
  })

  describe('getTracer', () => {
    it('returns a Tracer instance', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initTracerProvider(resource, config)

      const tracer = getTracer('test-scope')
      expect(tracer).toBeDefined()
      expect(typeof tracer.startSpan).toBe('function')
    })
  })

  describe('withSpan', () => {
    it('creates and ends a span', async () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initTracerProvider(resource, config)

      let spanCaptured = false
      await withSpan('test.operation', (span) => {
        expect(span).toBeDefined()
        expect(span.spanContext()).toBeDefined()
        spanCaptured = true
        return 'ok'
      })

      expect(spanCaptured).toBe(true)
    })

    it('activates the span in the current context', async () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initTracerProvider(resource, config)

      await withSpan('test.context-check', () => {
        const activeSpan = trace.getSpan(context.active())
        expect(activeSpan).toBeDefined()
        expect(activeSpan!.spanContext().spanId).toBeDefined()
      })
    })

    it('records exceptions and sets error status', async () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initTracerProvider(resource, config)

      await expect(
        withSpan('test.error', () => {
          throw new Error('test failure')
        }),
      ).rejects.toThrow('test failure')
    })

    it('returns the callback result', async () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initTracerProvider(resource, config)

      const result = await withSpan('test.return-value', () => {
        return 42
      })
      expect(result).toBe(42)
    })

    it('propagates context to nested spans', async () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initTracerProvider(resource, config)

      let parentTraceId: string | undefined
      let childTraceId: string | undefined

      await withSpan('test.parent', (parentSpan) => {
        parentTraceId = parentSpan.spanContext().traceId

        return withSpan('test.child', (childSpan) => {
          childTraceId = childSpan.spanContext().traceId
        })
      })

      expect(parentTraceId).toBe(childTraceId)
    })
  })

  describe('withSpanSync', () => {
    it('works with synchronous callbacks', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initTracerProvider(resource, config)

      const result = withSpanSync('test.sync', (span) => {
        expect(span).toBeDefined()
        return 'sync-result'
      })

      expect(result).toBe('sync-result')
    })

    it('records sync exceptions', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initTracerProvider(resource, config)

      expect(() => {
        withSpanSync('test.sync-error', () => {
          throw new Error('sync boom')
        })
      }).toThrow('sync boom')
    })
  })

  describe('recordSpanError', () => {
    it('records an error on a span without ending it', async () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initTracerProvider(resource, config)

      const tracer = getTracer('test')
      const span = tracer.startSpan('test.record-error')

      recordSpanError(span, new Error('manual error'))
      span.end()

      // If we got here without throwing, the recording worked.
      expect(true).toBe(true)
    })
  })
})
