/**
 * @module rate-limit.test
 * @description Unit tests for the rate limiting configuration module.
 */

import { describe, it, expect } from 'bun:test'
import {
  rateLimitConfig,
  RateLimitExceededError,
  createMemoryRateLimiter,
  createRedisRateLimiter,
  createRateLimiters,
} from '@/config/rate-limit'

describe('rateLimitConfig', () => {
  it('has correct structure', () => {
    expect(rateLimitConfig.windowSeconds).toBe(60)
    expect(rateLimitConfig.authenticated.points).toBe(100)
    expect(rateLimitConfig.authenticated.duration).toBe(60)
    expect(rateLimitConfig.anonymous.points).toBe(1000)
    expect(rateLimitConfig.anonymous.duration).toBe(60)
  })
})

describe('RateLimitExceededError', () => {
  it('has correct name and message', () => {
    const error = new RateLimitExceededError(5000)
    expect(error.name).toBe('RateLimitExceededError')
    expect(error.message).toBe('Rate limit exceeded.')
    expect(error.msBeforeNext).toBe(5000)
    expect(error).toBeInstanceOf(Error)
  })
})

describe('createMemoryRateLimiter', () => {
  it('creates a limiter with correct properties', () => {
    const limiter = createMemoryRateLimiter({
      keyPrefix: 'test',
      points: 5,
      duration: 60,
    })
    expect(limiter.keyPrefix).toBe('test')
    expect(limiter.points).toBe(5)
    expect(limiter.duration).toBe(60)
  })

  it('allows consume within quota', async () => {
    const limiter = createMemoryRateLimiter({
      keyPrefix: 'test-allow',
      points: 5,
      duration: 60,
    })
    const result = await limiter.consume('user-1')
    expect(result.remainingPoints).toBe(4)
    expect(result.msBeforeNext).toBeGreaterThan(0)
  })

  it('throws RateLimitExceededError when quota exhausted', async () => {
    const limiter = createMemoryRateLimiter({
      keyPrefix: 'test-exhaust',
      points: 2,
      duration: 60,
    })
    await limiter.consume('user-exhaust')
    await limiter.consume('user-exhaust')

    try {
      await limiter.consume('user-exhaust')
      expect(true).toBe(false) // should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitExceededError)
      expect((error as RateLimitExceededError).msBeforeNext).toBeGreaterThan(0)
    }
  })

  it('tracks different keys independently', async () => {
    const limiter = createMemoryRateLimiter({
      keyPrefix: 'test-independent',
      points: 2,
      duration: 60,
    })
    await limiter.consume('user-a')
    await limiter.consume('user-b')

    const resultA = await limiter.consume('user-a')
    expect(resultA.remainingPoints).toBe(0)

    const resultB = await limiter.consume('user-b')
    expect(resultB.remainingPoints).toBe(0)
  })
})

describe('createRedisRateLimiter', () => {
  it('creates a limiter with correct properties', () => {
    const mockRedis = {
      incr: async () => 1,
      expire: async () => true,
      pttl: async () => 59000,
    }

    const limiter = createRedisRateLimiter(mockRedis as any, {
      keyPrefix: 'rl:test',
      points: 100,
      duration: 60,
    })

    expect(limiter.keyPrefix).toBe('rl:test')
    expect(limiter.points).toBe(100)
    expect(limiter.duration).toBe(60)
  })

  it('increments key and sets expiry on first consume', async () => {
    let incrCalled = false
    const mockRedis = {
      incr: async () => {
        incrCalled = true
        return 1
      },
      expire: async () => true,
      pttl: async () => 59000,
    }

    const limiter = createRedisRateLimiter(mockRedis as any, {
      keyPrefix: 'rl:test-first',
      points: 100,
      duration: 60,
    })

    const result = await limiter.consume('user-1')
    expect(incrCalled).toBe(true)
    expect(result.remainingPoints).toBe(99)
    expect(result.msBeforeNext).toBe(59000)
  })

  it('does not set expiry on subsequent increments', async () => {
    let expireCalled = false
    const mockRedis = {
      incr: async () => 5,
      expire: async () => {
        expireCalled = true
        return true
      },
      pttl: async () => 55000,
    }

    const limiter = createRedisRateLimiter(mockRedis as any, {
      keyPrefix: 'rl:test-no-expire',
      points: 100,
      duration: 60,
    })

    await limiter.consume('user-1')
    expect(expireCalled).toBe(false)
  })

  it('throws RateLimitExceededError when limit exceeded', async () => {
    const mockRedis = {
      incr: async () => 101,
      expire: async () => true,
      pttl: async () => 30000,
    }

    const limiter = createRedisRateLimiter(mockRedis as any, {
      keyPrefix: 'rl:test-exceeded',
      points: 100,
      duration: 60,
    })

    try {
      await limiter.consume('user-1')
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitExceededError)
      expect((error as RateLimitExceededError).msBeforeNext).toBe(30000)
    }
  })

  it('handles negative TTL gracefully', async () => {
    const mockRedis = {
      incr: async () => 1,
      expire: async () => true,
      pttl: async () => -2,
    }

    const limiter = createRedisRateLimiter(mockRedis as any, {
      keyPrefix: 'rl:test-neg-ttl',
      points: 100,
      duration: 60,
    })

    const result = await limiter.consume('user-1')
    expect(result.msBeforeNext).toBe(60000)
  })
})

describe('createRateLimiters', () => {
  it('returns memory limiters when no redis client provided', () => {
    const limiters = createRateLimiters()
    expect(limiters.authenticated).toBeDefined()
    expect(limiters.anonymous).toBeDefined()
    expect(limiters.authenticated.keyPrefix).toBe('abugida:rl:authenticated')
    expect(limiters.anonymous.keyPrefix).toBe('abugida:rl:anonymous')
  })

  it('returns Redis limiters when redis client provided', () => {
    const mockRedis = {
      incr: async () => 1,
      expire: async () => true,
      pttl: async () => 59000,
    }
    const limiters = createRateLimiters(mockRedis as any)
    expect(limiters.authenticated).toBeDefined()
    expect(limiters.anonymous).toBeDefined()
    expect(limiters.authenticated.keyPrefix).toBe('abugida:rl:authenticated')
    expect(limiters.anonymous.keyPrefix).toBe('abugida:rl:anonymous')
  })

  it('authenticated limiter has correct points from config', () => {
    const limiters = createRateLimiters()
    expect(limiters.authenticated.points).toBe(100)
  })

  it('anonymous limiter has correct points from config', () => {
    const limiters = createRateLimiters()
    expect(limiters.anonymous.points).toBe(1000)
  })
})
