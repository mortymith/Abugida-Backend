/**
 * @module database
 *
 * API-specific database composition. Creates a single PostgreSQL `Pool` and
 * hands it to the shared Drizzle client so the pool is reused by both query
 * execution and health checks (no duplicate clients).
 *
 * Direction:
 *   app_config → database → @abugida/database
 */

import { Pool } from 'pg'
import { createClient, type DatabaseClient } from '@abugida/database/client'
import { appConfig } from './app_config'
import { logger } from './observability'

const pool = new Pool({
  connectionString: appConfig.DATABASE_URL,
  max: appConfig.DATABASE_POOL_MAX,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  application_name: 'abugida-api',
})

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected pg pool error on idle client')
})

const db: DatabaseClient = createClient({ client: pool })

export interface DatabaseConfig {
  /** Shared pg Pool — used for raw queries and health checks. */
  pool: Pool
  /** Drizzle client bound to the shared pool. */
  db: DatabaseClient
}

export const databaseConfig: DatabaseConfig = { pool, db }

export { pool, db }
