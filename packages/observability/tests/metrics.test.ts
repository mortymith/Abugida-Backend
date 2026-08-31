/**
 * Tests for the metrics module.
 */

import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { initMeterProvider, shutdownMeterProvider, getMeterProvider } from '../src/metrics/provider'
import {
  getMeter,
  createCounter,
  createHistogram,
  createUpDownCounter,
} from '../src/metrics/instruments'
import { createResource } from '../src/resource'
import { resolveConfig } from '../src/config'

describe('Metrics', () => {
  beforeEach(() => {
    shutdownMeterProvider()
  })

  afterEach(() => {
    shutdownMeterProvider()
  })

  describe('provider', () => {
    it('initialises a MeterProvider', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })

      const provider = initMeterProvider(resource, config)
      expect(provider).toBeDefined()
    })

    it('is idempotent', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })

      const first = initMeterProvider(resource, config)
      const second = initMeterProvider(resource, config)
      expect(first).toBe(second)
    })

    it('returns null before initialisation', () => {
      expect(getMeterProvider()).toBeNull()
    })

    it('returns the provider after initialisation', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })

      initMeterProvider(resource, config)
      expect(getMeterProvider()).toBeDefined()
    })
  })

  describe('getMeter', () => {
    it('returns a Meter instance', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initMeterProvider(resource, config)

      const meter = getMeter('test-meter')
      expect(meter).toBeDefined()
    })
  })

  describe('instruments', () => {
    it('creates a Counter', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initMeterProvider(resource, config)

      const meter = getMeter('test')
      const counter = createCounter(meter, 'test.counter', {
        description: 'A test counter',
      })
      expect(counter).toBeDefined()
      expect(typeof counter.add).toBe('function')
    })

    it('creates a Histogram', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initMeterProvider(resource, config)

      const meter = getMeter('test')
      const histogram = createHistogram(meter, 'test.histogram', {
        description: 'A test histogram',
      })
      expect(histogram).toBeDefined()
      expect(typeof histogram.record).toBe('function')
    })

    it('creates an UpDownCounter', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initMeterProvider(resource, config)

      const meter = getMeter('test')
      const upDown = createUpDownCounter(meter, 'test.updown', {
        description: 'A test up-down counter',
      })
      expect(upDown).toBeDefined()
      expect(typeof upDown.add).toBe('function')
    })

    it('records counter increments without throwing', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initMeterProvider(resource, config)

      const meter = getMeter('test')
      const counter = createCounter(meter, 'test.inc')
      counter.add(1, { method: 'GET' })
      counter.add(5, { method: 'POST' })
      // No assertion needed — if it throws, the test fails
      expect(true).toBe(true)
    })

    it('records histogram observations without throwing', () => {
      const resource = createResource('test', '1.0.0', 'test')
      const config = resolveConfig({
        serviceName: 'test',
        serviceVersion: '1.0.0',
        environment: 'test',
      })
      initMeterProvider(resource, config)

      const meter = getMeter('test')
      const histogram = createHistogram(meter, 'test.latency')
      histogram.record(120)
      histogram.record(340)
      expect(true).toBe(true)
    })
  })
})
