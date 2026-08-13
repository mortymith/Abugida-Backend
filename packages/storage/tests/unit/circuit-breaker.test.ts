/**
 * Unit tests for circuit breaker.
 */

import { describe, it, expect } from 'vitest'
import { CircuitBreaker } from '../../src/core/connection.ts'

describe('CircuitBreaker', () => {
  it('starts in closed state', () => {
    const cb = new CircuitBreaker()
    expect(cb.getState()).toBe('closed')
    expect(cb.isAllowed()).toBe(true)
  })

  it('opens after failure threshold', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 60_000 })
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.getState()).toBe('closed')
    cb.recordFailure()
    expect(cb.getState()).toBe('open')
    expect(cb.isAllowed()).toBe(false)
  })

  it('transitions to half-open after reset timeout', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 0 })
    cb.recordFailure()
    // With resetTimeout=0, getState() transitions to half-open immediately
    expect(cb.getState()).toBe('half-open')
    expect(cb.isAllowed()).toBe(true)
  })

  it('closes after enough successes in half-open', () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeout: 0,
      successThreshold: 2,
    })
    cb.recordFailure()
    // Already in half-open because resetTimeout=0
    expect(cb.getState()).toBe('half-open')
    cb.recordSuccess()
    expect(cb.getState()).toBe('half-open')
    cb.recordSuccess()
    expect(cb.getState()).toBe('closed')
  })

  it('reset forces closed state', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 60_000 })
    cb.recordFailure()
    expect(cb.getState()).toBe('open')
    cb.reset()
    expect(cb.getState()).toBe('closed')
    expect(cb.isAllowed()).toBe(true)
  })
})
