/**
 * @module core/tokens
 *
 * Opt-in JWT issuance for service-to-client consumers — currently PowerSync.
 * Enabled by passing a `tokens` block to `createAuth()`.
 *
 * When enabled, better-auth's `jwt` plugin is registered, which:
 *   - serves the signing keys at `GET <basePath>/jwks` (with this package's
 *     default `basePath` of `/auth`, that is `GET /auth/jwks`)
 *   - mints short-lived JWTs (sub = user id) via its `/token` endpoint
 * and the `bearer` plugin is registered so those tokens authenticate API
 * requests as bearer credentials.
 *
 * Consumers MUST add better-auth's generated `jwks` table to their Drizzle
 * schema (`@better-auth/cli generate` after enabling this) — the plugin
 * persists its encrypted private keys there.
 *
 * PowerSync wiring: point `client_auth.jwks_uri` in
 * docker/config/powersync/service.yaml at `<baseUrl>/auth/jwks` and set
 * `client_auth.audience` to match the audience here (see DEFAULT_TOKEN_AUDIENCE).
 */

import { bearer } from 'better-auth/plugins/bearer'
import { jwt } from 'better-auth/plugins/jwt'
import type { BetterAuthPlugin } from 'better-auth'
import type { AuthConfig } from './types'

/**
 * Default audience claim. Keep in sync with `client_auth.audience` in
 * docker/config/powersync/service.yaml.
 */
export const DEFAULT_TOKEN_AUDIENCE = 'abugida'

/**
 * Builds the token plugins for the configured auth instance. Returns an
 * empty array when no `tokens` config is provided, keeping the default
 * install surface unchanged.
 */
export function buildTokenPlugins(config: AuthConfig): BetterAuthPlugin[] {
  if (!config.tokens) return []

  return [
    jwt({
      jwt: {
        issuer: config.tokens.issuer ?? config.baseUrl,
        audience: config.tokens.audience ?? DEFAULT_TOKEN_AUDIENCE,
        // Sync clients poll frequently; keep access windows tight. The
        // bearer plugin refreshes transparently while a session is alive.
        expirationTime: 60 * 15,
      },
    }),
    bearer(),
  ]
}
