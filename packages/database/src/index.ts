export * from './schema'
export * from './enums'
export * from './types'
export { createClient, type DatabaseClient } from './client'

/**
 * Re-export the Drizzle operators used by workspace consumers. Keep this
 * explicit instead of turning the database root into an unbounded Drizzle
 * facade; domain schemas remain available through their dedicated subpaths.
 */
export {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm'
