import { createClient } from '../src/client'

/**
 * Example: a shared database client for the example scripts.
 *
 * The examples run against the local development database. `DATABASE_URL`
 * comes from the repository `.env` (the same variable the API and the
 * dashboard use), so the examples work without extra configuration.
 */
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required (set it in the repository .env or as env var)')
}

export const db = createClient(connectionString)
