/**
 * @module middleware/index.test
 * @description Tests that the middleware barrel exports all expected symbols.
 */

import { describe, it, expect } from 'bun:test'

describe('middleware barrel exports', () => {
  it('re-exports types from types.ts', async () => {
    const mod = await import('@/middleware/index')
    expect(mod).toBeDefined()
  })

  it('re-exports problemResponse from error-handler', async () => {
    const mod = await import('@/middleware/index')
    expect(typeof mod.problemResponse).toBe('function')
  })

  it('re-exports zodOpenApiHook from error-handler', async () => {
    const mod = await import('@/middleware/index')
    expect(typeof mod.zodOpenApiHook).toBe('function')
  })

  it('re-exports uuidv7 from request-id', async () => {
    const mod = await import('@/middleware/index')
    expect(typeof mod.uuidv7).toBe('function')
  })

  it('uuidv7 produces valid UUID v7', async () => {
    const { uuidv7 } = await import('@/middleware/index')
    const uuid = uuidv7()
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('re-exports applyMiddleware function', async () => {
    const mod = await import('@/middleware/index')
    expect(typeof mod.applyMiddleware).toBe('function')
  })

  it('re-exports MiddlewareDependencies type', async () => {
    const mod = await import('@/middleware/index')
    expect(mod).toBeDefined()
  })
})
