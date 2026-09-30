/**
 * Server-only auth instance — the dashboard's single Better Auth instance.
 *
 * Never import this from route files or client code. Server functions in
 * `auth.config.ts` and the `/auth/*` request handler in
 * `src/default-entry/server.ts` reach it through `getAuth()`.
 *
 * The instance itself — plugin registry (Google, Telegram OIDC, two-factor,
 * organizations), session, cookie, rate-limit and trusted-origin policy, and
 * the `@abugida/database` schema binding — is owned by `@abugida/auth`. This
 * module contributes only the dashboard's environment, database client and
 * logger, so the dashboard and the API cannot drift on any of the rest.
 *
 * Built lazily and memoized: the shared logger only exists after
 * `initObservability()`, and a second better-auth instance would keep its own
 * cookie cache and plugin registry.
 */
import { createAbugidaAuth } from '@abugida/auth'
import type { AuthInstance } from '@abugida/auth'
import { resolveAuthEnv } from '@abugida/auth/env'
import { env } from './app.config'
import { db } from './db.config'
import { logger } from './observability.config'

let instance: AuthInstance | undefined

export function getAuth(): AuthInstance {
  instance ??= createAbugidaAuth({ env: resolveAuthEnv(env), db, logger })
  return instance
}
