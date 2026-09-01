/**
 * @module database.test
 * @description Unit tests for the database configuration module.
 *
 * These tests verify the database module's interface and exports.
 * The module creates a pg Pool and Drizzle client from appConfig at import time.
 */

import { describe, it, expect } from 'bun:test'

describe('database module', () => {
  it('exports a databaseConfig object', async () => {
    const mod = await import('@/config/database')
    expect(mod.databaseConfig).toBeDefined()
    expect(typeof mod.databaseConfig).toBe('object')
  })

  it('databaseConfig has pool property', async () => {
    const mod = await import('@/config/database')
    expect(mod.databaseConfig.pool).toBeDefined()
  })

  it('databaseConfig has db property', async () => {
    const mod = await import('@/config/database')
    expect(mod.databaseConfig.db).toBeDefined()
  })

  it('exports pool as named export', async () => {
    const mod = await import('@/config/database')
    expect(mod.pool).toBeDefined()
    expect(mod.pool).toBe(mod.databaseConfig.pool)
  })

  it('exports db as named export', async () => {
    const mod = await import('@/config/database')
    expect(mod.db).toBeDefined()
    expect(mod.db).toBe(mod.databaseConfig.db)
  })
})
