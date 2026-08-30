import { drizzle } from 'drizzle-orm/node-postgres'
import type { DrizzleConfig } from 'drizzle-orm/utils'
import { Pool, type PoolClient, type PoolConfig } from 'pg'
import * as schema from '../schema'

type SchemaConfig = DrizzleConfig<typeof schema>

export type ClientConfig = {
  /** Existing pg Pool or Client instance. Takes precedence over `connection`. */
  client?: Pool | PoolClient
  /** Connection string or pg PoolConfig object. Ignored when `client` is provided. */
  connection?: string | PoolConfig
  /** Enable query logging. `true` uses the default logger; pass a custom `Logger` instance for advanced use. */
  logger?: SchemaConfig['logger']
  /** Column name casing strategy. `'snake_case'` maps camelCase TS props to snake_case DB columns. */
  casing?: SchemaConfig['casing']
  /** Cache implementation for query caching (e.g., PowerSync or custom layer). */
  cache?: SchemaConfig['cache']
}

export type CreateClientInput = string | ClientConfig

export function createClient(input: string): ReturnType<typeof drizzle<typeof schema>>
export function createClient(input: ClientConfig): ReturnType<typeof drizzle<typeof schema>>
export function createClient(input: CreateClientInput) {
  if (typeof input === 'string') {
    return drizzle(input, { schema })
  }

  const { client, connection, ...config } = input

  if (client) {
    return drizzle(client, { schema, ...config })
  }

  if (typeof connection === 'string') {
    return drizzle(connection, { schema, ...config })
  }

  return drizzle({ connection: connection ?? {}, schema, ...config })
}

export type DatabaseClient = ReturnType<typeof createClient>
