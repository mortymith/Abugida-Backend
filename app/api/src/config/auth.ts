/**
 * @module auth
 *
 * The API's auth wiring, now a thin adapter over `@abugida/auth`.
 *
 * All auth *policy* — the Better Auth instance, its plugin registry (Google,
 * Telegram OIDC, two-factor, organizations), session/cookie/rate-limit
 * settings, the trusted-origin allowlist and the database binding — lives in
 * `@abugida/auth`. This module only supplies the three things that are the
 * API's to decide: which environment it is running in, which Drizzle client
 * to use, and which logger to report through.
 *
 *   app_config → resolveAuthEnv → createAbugidaAuth
 *
 * The instance is created once per process and memoized: two better-auth
 * instances in one runtime would each keep their own cookie/session caches and
 * plugin registries, which is exactly the drift this package removes.
 */

import { createAbugidaAuth, type AuthInstance } from '@abugida/auth'
import { resolveAuthEnv } from '@abugida/auth/env'
import { appConfig } from './app_config'
import { db } from './database'
import { logger } from './observability'

let instance: AuthInstance | undefined

/**
 * The shared auth instance. Call after observability is initialized so the
 * shared logger is available. Fails fast if the environment is unusable (no
 * secret, no provider, weak secret, …) — the shared package owns those rules.
 */
export function createAuthInstance(): AuthInstance {
  instance ??= createAbugidaAuth({
    env: resolveAuthEnv(appConfig),
    db,
    logger,
  })
  return instance
}
