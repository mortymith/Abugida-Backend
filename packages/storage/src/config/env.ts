/**
 * Environment-based configuration helpers.
 *
 * These functions read storage configuration from environment variables,
 * which is the recommended approach for 12-factor apps and containerised
 * deployments.
 */

import type { StorageConfig, StorageProvider } from '../core/types.ts'

/** Environment variable prefix. */
const PREFIX = 'STORAGE_'

/**
 * Build a `StorageConfig` from environment variables.
 *
 * Recognised variables (all prefixed with `STORAGE_`):
 * | Variable                  | Maps to            |
 * |--------------------------|--------------------|
 * | `STORAGE_PROVIDER`       | `provider`         |
 * | `STORAGE_ENDPOINT`       | `endpoint`         |
 * | `STORAGE_REGION`         | `region`           |
 * | `STORAGE_ACCESS_KEY_ID`  | `accessKeyId`      |
 * | `STORAGE_SECRET_ACCESS_KEY` | `secretAccessKey` |
 * | `STORAGE_BUCKET`         | `bucket`           |
 * | `STORAGE_FORCE_PATH_STYLE` | `forcePathStyle`  |
 * | `STORAGE_MAX_ATTEMPTS`   | `maxAttempts`      |
 * | `STORAGE_REQUEST_TIMEOUT` | `requestTimeout`  |
 * | `STORAGE_CONNECTION_TIMEOUT` | `connectionTimeout` |
 *
 * @param env - Environment map (defaults to `process.env` / `Bun.env`).
 * @returns A `StorageConfig` populated from the environment.
 * @throws {Error} when required variables are missing.
 */
export function configFromEnv(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): StorageConfig {
  const get = (key: string): string | undefined => env[`${PREFIX}${key}`]

  const provider = get('PROVIDER') as StorageProvider | undefined
  if (!provider) {
    throw new Error(`Missing environment variable: ${PREFIX}PROVIDER`)
  }

  const endpoint = get('ENDPOINT')
  const region = get('REGION')
  const accessKeyId = get('ACCESS_KEY_ID')
  const secretAccessKey = get('SECRET_ACCESS_KEY')
  const bucket = get('BUCKET')

  if (!accessKeyId) throw new Error(`Missing environment variable: ${PREFIX}ACCESS_KEY_ID`)
  if (!secretAccessKey) throw new Error(`Missing environment variable: ${PREFIX}SECRET_ACCESS_KEY`)
  if (!bucket) throw new Error(`Missing environment variable: ${PREFIX}BUCKET`)

  return {
    provider,
    endpoint: endpoint ?? '',
    region: region ?? 'us-east-1',
    accessKeyId,
    secretAccessKey,
    bucket,
    forcePathStyle: get('FORCE_PATH_STYLE') === 'true',
    maxAttempts: get('MAX_ATTEMPTS') ? Number(get('MAX_ATTEMPTS')) : undefined,
    requestTimeout: get('REQUEST_TIMEOUT') ? Number(get('REQUEST_TIMEOUT')) : undefined,
    connectionTimeout: get('CONNECTION_TIMEOUT') ? Number(get('CONNECTION_TIMEOUT')) : undefined,
  }
}

/**
 * Check whether all required environment variables are present.
 *
 * @returns `true` when the minimum set is available.
 */
export function hasEnvConfig(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): boolean {
  const get = (key: string): string | undefined => env[`${PREFIX}${key}`]
  return !!(get('PROVIDER') && get('ACCESS_KEY_ID') && get('SECRET_ACCESS_KEY') && get('BUCKET'))
}
