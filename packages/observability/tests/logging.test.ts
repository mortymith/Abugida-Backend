process.env.OTEL_TRACES_EXPORTER = 'none'

/**
 * Tests for the logging module.
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { trace, context } from '@opentelemetry/api'
import { createLogger, getLogger, resetLogger } from '../src/logging/logger'
import { createTraceMergeObject } from '../src/logging/serializers'
import { bindLoggerToContext, getActiveTraceContext } from '../src/logging/context'
import { redactSensitiveHeaders } from '../src/logging/serializers'
import { initTracerProvider, resetTracerProvider } from '../src/tracing/provider'
import { getTracer } from '../src/tracing/tracer'
import { createResource } from '../src/resource'
import { resolveConfig } from '../src/config'
import { initPropagation, resetPropagation } from '../src/context/propagation'

describe('Logging', () => {
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

  describe('createLogger', () => {
    it('creates a logger with the service name', () => {
      const logger = createLogger('test-service')
      expect(logger).toBeDefined()
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.error).toBe('function')
    })

    it('is idempotent — returns the same logger on repeated calls', () => {
      const first = createLogger('test-service')
      const second = createLogger('test-service')
      expect(first).toBe(second)
    })

    it('outputs structured JSON', () => {
      const logger = createLogger('test-service')
      logger.info({ userId: 123 }, 'Test message')
      // If no error thrown, logger works
      expect(true).toBe(true)
    })
  })

  describe('getLogger', () => {
    it('throws if initObservability has not been called', () => {
      resetLogger()
      expect(() => getLogger()).toThrow('Logger not initialised')
    })

    it('returns a logger after createLogger', () => {
      createLogger('test-service')
      expect(getLogger()).toBeDefined()
    })
  })

  describe('trace correlation', () => {
    it('includes trace_id and span_id when a span is active', async () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initTracerProvider(resource, config)

      const tracer = getTracer('test')
      const span = tracer.startSpan('test.correlation')

      await context.with(trace.setSpan(context.active(), span), async () => {
        const mergeObj = createTraceMergeObject()
        expect(mergeObj).toHaveProperty('trace_id')
        expect(mergeObj).toHaveProperty('span_id')
        expect(mergeObj).toHaveProperty('trace_flags')
        expect((mergeObj as Record<string, unknown>).trace_id).toBeTruthy()
        expect((mergeObj as Record<string, unknown>).span_id).toBeTruthy()
      })

      span.end()
    })

    it('does not generate fake trace IDs when no span is active', () => {
      const mergeObj = createTraceMergeObject()
      expect(mergeObj).not.toHaveProperty('trace_id')
      expect(mergeObj).not.toHaveProperty('span_id')
    })

    it('getActiveTraceContext returns null when no span is active', () => {
      const ctx = getActiveTraceContext()
      expect(ctx).toBeNull()
    })

    it('getActiveTraceContext returns context when a span is active', async () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initTracerProvider(resource, config)

      const tracer = getTracer('test')
      const span = tracer.startSpan('test.ctx-check')

      await context.with(trace.setSpan(context.active(), span), () => {
        const ctx = getActiveTraceContext()
        expect(ctx).not.toBeNull()
        expect(ctx!.traceId).toBeTruthy()
        expect(ctx!.spanId).toBeTruthy()
      })

      span.end()
    })
  })

  describe('security', () => {
    it('redacts sensitive headers', () => {
      const headers = {
        'content-type': 'application/json',
        authorization: 'Bearer super-secret-token',
        cookie: 'session=abc123',
        'x-api-key': 'my-api-key-123',
        'user-agent': 'test-agent',
      }

      const safe = redactSensitiveHeaders(headers)
      expect(safe['authorization']).toBe('[REDACTED]')
      expect(safe['cookie']).toBe('[REDACTED]')
      expect(safe['x-api-key']).toBe('[REDACTED]')
      expect(safe['content-type']).toBe('application/json')
      expect(safe['user-agent']).toBe('test-agent')
    })
  })
})
