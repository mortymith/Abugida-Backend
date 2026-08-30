import { describe, it, expect } from 'bun:test'
import { createClient } from '../src/client'

describe('createClient', () => {
  describe('string overload', () => {
    it('returns a drizzle instance with string URL', () => {
      const db = createClient('postgresql://user:pass@localhost:5432/test')
      expect(db).toBeDefined()
      expect(db.$client).toBeDefined()
    })

    it('exposes $client as a Pool', () => {
      const db = createClient('postgresql://user:pass@localhost:5432/test')
      expect(db.$client).toHaveProperty('connect')
      expect(db.$client).toHaveProperty('end')
      expect(db.$client).toHaveProperty('query')
    })

    it('exposes query relational API', () => {
      const db = createClient('postgresql://user:pass@localhost:5432/test')
      expect(db.query).toBeDefined()
      expect(typeof db.query).toBe('object')
    })

    it('exposes core query methods', () => {
      const db = createClient('postgresql://user:pass@localhost:5432/test')
      expect(typeof db.select).toBe('function')
      expect(typeof db.insert).toBe('function')
      expect(typeof db.update).toBe('function')
      expect(typeof db.delete).toBe('function')
    })
  })

  describe('config object with connection string', () => {
    it('returns a drizzle instance with connection string', () => {
      const db = createClient({ connection: 'postgresql://user:pass@localhost:5432/test' })
      expect(db).toBeDefined()
      expect(db.$client).toBeDefined()
    })

    it('exposes query relational API', () => {
      const db = createClient({ connection: 'postgresql://user:pass@localhost:5432/test' })
      expect(db.query).toBeDefined()
    })

    it('passes logger option', () => {
      const db = createClient({
        connection: 'postgresql://user:pass@localhost:5432/test',
        logger: false,
      })
      expect(db).toBeDefined()
    })

    it('passes casing option', () => {
      const db = createClient({
        connection: 'postgresql://user:pass@localhost:5432/test',
        casing: 'snake_case',
      })
      expect(db).toBeDefined()
    })
  })

  describe('config object with PoolConfig', () => {
    it('returns a drizzle instance with PoolConfig', () => {
      const db = createClient({
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'test',
          user: 'user',
          password: 'pass',
        },
      })
      expect(db).toBeDefined()
      expect(db.$client).toBeDefined()
    })

    it('exposes query relational API', () => {
      const db = createClient({
        connection: { host: 'localhost', port: 5432, database: 'test' },
      })
      expect(db.query).toBeDefined()
    })
  })

  describe('config object with existing Pool', () => {
    it('returns a drizzle instance with Pool', () => {
      const { Pool } = require('pg')
      const pool = new Pool({ connectionString: 'postgresql://user:pass@localhost:5432/test' })
      const db = createClient({ client: pool })
      expect(db).toBeDefined()
      expect(db.$client).toBe(pool)
    })

    it('exposes query relational API', () => {
      const { Pool } = require('pg')
      const pool = new Pool({ connectionString: 'postgresql://user:pass@localhost:5432/test' })
      const db = createClient({ client: pool })
      expect(db.query).toBeDefined()
    })

    it('client takes precedence over connection', () => {
      const { Pool } = require('pg')
      const pool = new Pool({ connectionString: 'postgresql://user:pass@localhost:5432/test' })
      const db = createClient({
        client: pool,
        connection: 'postgresql://other:pass@otherhost:5432/other',
      })
      expect(db.$client).toBe(pool)
    })
  })

  describe('empty config object', () => {
    it('returns a drizzle instance with empty connection defaults', () => {
      const db = createClient({})
      expect(db).toBeDefined()
      expect(db.$client).toBeDefined()
    })
  })
})
