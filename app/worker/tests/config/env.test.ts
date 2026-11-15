/**
 * @test config/env
 * @description Unit tests for the worker's environment schema.
 */

import { describe, expect, test } from 'bun:test'

import { parseWorkerEnv } from '@/config/app_config'

describe('parseWorkerEnv', () => {
  test('applies the documented defaults', () => {
    const env = parseWorkerEnv({})

    expect(env.NODE_ENV).toBe('development')
    expect(env.LOG_LEVEL).toBe('info')
    expect(env.APP_NAME).toBe('abugida-worker')
    expect(env.WORKER_QUEUES).toBe('all')
    expect(env.REDIS_HOST).toBe('localhost')
    expect(env.REDIS_PORT).toBe(6379)
    expect(env.REDIS_DB).toBe(0)
    expect(env.REDIS_TLS).toBe(false)
  })

  test('ENVIRONMENT wins over NODE_ENV', () => {
    const env = parseWorkerEnv({ ENVIRONMENT: 'production', NODE_ENV: 'development' })
    expect(env.NODE_ENV).toBe('production')
  })

  test('coerces numeric strings', () => {
    const env = parseWorkerEnv({ REDIS_PORT: '6380', REDIS_DB: '2', PORT: '3100' })
    expect(env.REDIS_PORT).toBe(6380)
    expect(env.REDIS_DB).toBe(2)
    expect(env.PORT).toBe(3100)
  })

  test('parses boolean flags', () => {
    expect(parseWorkerEnv({ REDIS_TLS: 'true' }).REDIS_TLS).toBe(true)
    expect(parseWorkerEnv({ REDIS_TLS: '1' }).REDIS_TLS).toBe(true)
    expect(parseWorkerEnv({ REDIS_TLS: 'false' }).REDIS_TLS).toBe(false)
    expect(parseWorkerEnv({ REDIS_TLS: '0' }).REDIS_TLS).toBe(false)
  })

  test('rejects an invalid port', () => {
    expect(() => parseWorkerEnv({ PORT: 'not-a-port' })).toThrow(/Invalid environment/i)
  })

  test('rejects an unknown log level', () => {
    expect(() => parseWorkerEnv({ LOG_LEVEL: 'verbose' })).toThrow(/Invalid environment/i)
  })

  test('the error report names the variable but never its value', () => {
    try {
      parseWorkerEnv({ PORT: '99999' })
      throw new Error('expected the parse to fail')
    } catch (err) {
      const message = (err as Error).message
      expect(message).toContain('PORT')
      expect(message).not.toContain('99999')
    }
  })
})
