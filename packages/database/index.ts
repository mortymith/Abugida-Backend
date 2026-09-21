export * from './schema'
export * from './src/enums'
export * from './src/types'
export { createClient, type DatabaseClient } from './src/client'

/**
 * Re-export drizzle-orm's operators and helpers so consumers have a single,
 * type-consistent SQL toolkit. Importing `and`, `eq`, `sql`, … directly from
 * `drizzle-orm` can resolve a different package instance than the one this
 * package's schemas were typed against (pnpm peer-context forks), producing
 * spurious `SQL<unknown>` incompatibilities at typecheck.
 */
export * from 'drizzle-orm'
