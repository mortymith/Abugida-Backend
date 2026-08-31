process.env.OTEL_TRACES_EXPORTER = 'none'

/**
 * Tests for context propagation.
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { trace, context, propagation } from '@opentelemetry/api'
import {
  initPropagation,
  extractContext,
  injectContext,
  resetPropagation,
} from '../src/context/propagation'
import { extractRequestContext } from '../src/context/request-context'
import { initTracerProvider, resetTracerProvider } from '../src/tracing/provider'
import { getTracer } from '../src/tracing/tracer'
import { createResource } from '../src/resource'
import { resolveConfig } from '../src/config'

describe('Context Propagation', () => {
  beforeEach(() => {
    resetTracerProvider()
    resetPropagation()
    initPropagation()
  })

  afterEach(() => {
    resetTracerProvider()
    resetPropagation()
  })

  describe('initPropagation', () => {
    it('is idempotent', () => {
      initPropagation()
      initPropagation()
      expect(true).toBe(true)
    })
  })

  describe('inject/extract roundtrip', () => {
    it('preserves trace context through inject → extract', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initTracerProvider(resource, config)

      const tracer = getTracer('test')
      const span = tracer.startSpan('test.inject-extract')
      const ctx = trace.setSpan(context.active(), span)

      const carrier: Record<string, string> = {}
      injectContext(carrier, ctx)

      expect(carrier['traceparent']).toBeTruthy()

      const extractedCtx = extractContext(carrier)
      const extractedSpan = trace.getSpan(extractedCtx)

      expect(extractedSpan).toBeDefined()
      expect(extractedSpan!.spanContext().traceId).toBe(span.spanContext().traceId)

      span.end()
    })

    it('works with lowercase header keys', () => {
      const carrier: Record<string, string> = {
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      }

      const ctx = extractContext(carrier)
      const span = trace.getSpan(ctx)

      expect(span).toBeDefined()
      expect(span!.spanContext().traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
    })
  })

  describe('extractRequestContext', () => {
    it('extracts from a Headers instance', () => {
      const headers = new Headers({
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      })

      const ctx = extractRequestContext(headers)
      const span = trace.getSpan(ctx)

      expect(span).toBeDefined()
    })

    it('extracts from a plain record', () => {
      const headers: Record<string, string> = {
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      }

      const ctx = extractRequestContext(headers)
      const span = trace.getSpan(ctx)

      expect(span).toBeDefined()
    })

    it('extracts from a get()-style object', () => {
      const headers = {
        get(name: string): string | null {
          if (name === 'traceparent') {
            return '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
          }
          return null
        },
      }

      const ctx = extractRequestContext(headers)
      const span = trace.getSpan(ctx)

      expect(span).toBeDefined()
    })
  })
})
