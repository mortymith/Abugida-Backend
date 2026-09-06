/**
 * @module providers/telegram
 *
 * Telegram authentication via the `better-auth-telegram` plugin
 * (https://www.npmjs.com/package/better-auth-telegram), configured for its
 * **Telegram OpenID Connect flow only**:
 *
 *   - **OIDC** (oauth.telegram.org) is a standard OAuth 2.0 + PKCE redirect
 *     flow; during plugin init the plugin registers it as a real social
 *     provider (`provider: "telegram-oidc"`) through better-auth's own
 *     `/sign-in/social` and `/callback/:provider` routes. Sessions, accounts,
 *     and token storage are therefore identical to Google's.
 *
 * The plugin's legacy flows are deliberately left off via `loginWidget: false`
 * and no `miniApp` config: the HMAC-verified Login Widget endpoints
 * (`/telegram/signin|link|unlink`), the Mini App endpoints, and the plugin's
 * `telegram*` user/account schema fields are never registered, and no bot
 * token is required. This module only validates the credential shape at
 * startup (fail fast, not at request time) and turns the shared
 * `TelegramProviderCredentials` into plugin options.
 */

import { telegram } from 'better-auth-telegram'
import type { BetterAuthPlugin } from 'better-auth'
import type { AuthConfig, TelegramProviderCredentials } from '../core/types'
import { assertNonEmpty, invalidCredential } from './base'

/**
 * Validates Telegram OIDC credentials at startup, throwing a typed
 * AuthConfigError on the first problem.
 */
export function validateTelegramCredentials(credentials: TelegramProviderCredentials): void {
  assertNonEmpty('telegram', 'clientId', credentials.clientId)
  assertNonEmpty('telegram', 'clientSecret', credentials.clientSecret)

  if (credentials.scopes?.some((scope) => scope.trim().length === 0)) {
    invalidCredential('telegram', 'scopes', 'Scope entries must be non-empty strings.')
  }
}

/**
 * Builds the better-auth-telegram plugin for the configured auth instance,
 * restricted to the Telegram OIDC redirect flow. Returns an empty array when
 * Telegram is not configured, keeping the default install surface unchanged
 * (mirrors `core/tokens.ts`).
 */
export function buildTelegramPlugins(config: AuthConfig): BetterAuthPlugin[] {
  const credentials = config.providers.telegram
  if (!credentials) return []

  validateTelegramCredentials(credentials)

  return [
    telegram({
      // OIDC is the only supported Telegram flow: disabling the Login Widget
      // (and omitting Mini App config) keeps the plugin from registering its
      // HMAC endpoints and telegram* user/account schema fields.
      loginWidget: false,
      oidc: {
        enabled: true,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        // Telegram only returns phone_number after the user grants the phone
        // scope. Keep this backend-controlled so clients cannot accidentally
        // omit it from the authorization request.
        requestPhone: credentials.requestPhone ?? true,
        ...(credentials.scopes !== undefined ? { scopes: [...credentials.scopes] } : {}),
      },
    }),
  ]
}
