export * from './schema'
export * from './src/enums'
export * from './src/types'
export { createClient, type DatabaseClient } from './src/client'

/**
 * Re-export the Drizzle operators used by workspace consumers. Keep this
 * explicit instead of turning the database root into an unbounded Drizzle
 * facade; domain schemas remain available through their dedicated subpaths.
 */
export { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm'
