/**
 * Unit tests for circuit breaker.
 */

import { describe, test, expect } from 'bun:test'
import { CircuitBreaker } from '../../src/core/connection.ts'

describe('CircuitBreaker', () => {
  test('starts in closed state', () => {
    const cb = new CircuitBreaker()
    expect(cb.getState()).toBe('closed')
    expect(cb.isAllowed()).toBe(true)
  })

  test('opens after failure threshold', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 60_000 })
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.getState()).toBe('closed')
    cb.recordFailure()
    expect(cb.getState()).toBe('open')
    expect(cb.isAllowed()).toBe(false)
  })

  test('transitions to half-open after reset timeout', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 0 })
    cb.recordFailure()
    // With resetTimeout=0, getState() transitions to half-open immediately
    expect(cb.getState()).toBe('half-open')
    expect(cb.isAllowed()).toBe(true)
  })

  test('closes after enough successes in half-open', () => {
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

  test('reset forces closed state', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 60_000 })
    cb.recordFailure()
    expect(cb.getState()).toBe('open')
    cb.reset()
    expect(cb.getState()).toBe('closed')
    expect(cb.isAllowed()).toBe(true)
  })
})
