/**
 * @test runtime/health
 * @description Unit tests for the worker's health endpoints.
 */

import { describe, expect, test } from 'bun:test'

import { createHealthApp, type HealthProvider } from '@/runtime/health'

function makeProvider(overrides: Partial<HealthProvider> = {}): HealthProvider {
  return {
    version: () => '1.2.3',
    expectedQueues: () => ['abugida.purchases'],
    startedQueues: () => ['abugida.purchases'],
    isWorkerRunning: () => true,
    isRedisReachable: async () => true,
    ...overrides,
  }
}

describe('GET /health', () => {
  test('reports liveness with the version and a timestamp', async () => {
    const app = createHealthApp(makeProvider())

    const res = await app.request('/health')
    expect(res.status).toBe(200)

    const body = (await res.json()) as Record<string, unknown>
    expect(body['status']).toBe('ok')
    expect(body['version']).toBe('1.2.3')
    expect(typeof body['uptime']).toBe('number')
    expect(typeof body['timestamp']).toBe('string')
  })

  test('stays green even when a dependency is down', async () => {
    const app = createHealthApp(
      makeProvider({
        isRedisReachable: async () => false,
        isWorkerRunning: () => false,
      }),
    )

    const res = await app.request('/health')
    expect(res.status).toBe(200)
  })
})

describe('GET /health/ready', () => {
  test('is ready when Redis is reachable and every queue worker started', async () => {
    const app = createHealthApp(makeProvider())

    const res = await app.request('/health/ready')
    expect(res.status).toBe(200)

    const body = (await res.json()) as Record<string, unknown>
    expect(body['status']).toBe('ok')
    const checks = body['checks'] as Record<string, unknown>
    expect(checks['redis']).toBe('ok')
    expect(checks['worker']).toBe('ok')
  })

  test('is not ready when Redis is unreachable', async () => {
    const app = createHealthApp(makeProvider({ isRedisReachable: async () => false }))

    const res = await app.request('/health/ready')
    expect(res.status).toBe(503)
  })

  test('is not ready when the worker is not running', async () => {
    const app = createHealthApp(makeProvider({ isWorkerRunning: () => false }))

    const res = await app.request('/health/ready')
    expect(res.status).toBe(503)
  })

  test('is not ready when a queue worker has not started', async () => {
    const app = createHealthApp(makeProvider({ startedQueues: () => [] }))

    const res = await app.request('/health/ready')
    expect(res.status).toBe(503)
  })
})
