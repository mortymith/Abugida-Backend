/**
 * @module plugins/server
 *
 * The single, authoritative Better Auth plugin registry.
 *
 * Every plugin the Abugida platform serves is registered here, once, in a
 * fixed order. Consuming apps cannot add, remove or reorder plugins: an
 * instance that behaves differently in the API than in the dashboard is a
 * session, cookie and route contract that quietly diverges, so the
 * escape hatch (`additionalPlugins`) is deliberately not part of the public
 * configuration any more.
 *
 * Order matters and is intentional:
 *   1. providers (Google, Telegram OIDC) — social sign-in
 *   2. JWT + bearer — token issuance for sync clients
 *   3. two-factor — OTP challenge, backup codes, account lockout
 *   4. organization — workspaces, memberships, invitations
 *   5. OpenAPI — machine-generated documentation of the routes above
 *
 * The organization plugin is declared with the `useCase` additional field
 * because `@abugida/database`'s `organization.use_case` column is
 * `NOT NULL`: the field is part of this package's contract with the schema
 * and is not something an app may opt out of.
 */

import { organization } from 'better-auth/plugins/organization'
import { twoFactor } from 'better-auth/plugins/two-factor'
import { openAPI } from 'better-auth/plugins'
import type { BetterAuthPlugin } from 'better-auth'
import type { AuthConfig, OrganizationConfig, TwoFactorConfig } from '../core/types'
import { buildTelegramPlugins } from '../providers/telegram'
import { buildTokenPlugins } from '../core/tokens'
import { ORGANIZATION_ADDITIONAL_FIELDS } from './constants'

export { ORGANIZATION_ADDITIONAL_FIELDS }

/** Two-factor (TOTP + backup codes) is always on; see `TwoFactorConfig`. */
export function buildTwoFactorPlugin(config: AuthConfig): BetterAuthPlugin | null {
  const policy = config.twoFactor
  if (!policy) return null

  return twoFactor({
    issuer: policy.issuer,
    // The Abugida platform has no passwords at all — sign-in is Google or
    // Telegram OIDC only. Without this, better-auth demands a `password` on
    // `enableTwoFactor` / `disableTwoFactor` and enrolment is impossible for
    // every user. The session cookie is the proof of possession instead.
    allowPasswordless: true,
    ...(policy.twoFactorCookieMaxAge !== undefined
      ? { twoFactorCookieMaxAge: policy.twoFactorCookieMaxAge }
      : {}),
    ...(policy.trustDeviceMaxAge !== undefined
      ? { trustDeviceMaxAge: policy.trustDeviceMaxAge }
      : {}),
    ...(policy.accountLockout
      ? {
          // The option is `durationSeconds`. A `lockDuration` key is not
          // recognised by better-auth, which then silently falls back to its
          // own 900s default — the reason the cooldown is spelled out here.
          accountLockout: {
            maxFailedAttempts: policy.accountLockout.maxFailedAttempts,
            durationSeconds: policy.accountLockout.durationSeconds,
          },
        }
      : {}),
  })
}

/** Organizations are always on; `config.organization` only tunes behaviour. */
export function buildOrganizationPlugin(config: AuthConfig): BetterAuthPlugin {
  const organizationConfig: OrganizationConfig = config.organization ?? {}

  return organization({
    ...(organizationConfig.allowUserToCreateOrganization !== undefined
      ? { allowUserToCreateOrganization: organizationConfig.allowUserToCreateOrganization }
      : {}),
    schema: {
      organization: {
        additionalFields: { ...ORGANIZATION_ADDITIONAL_FIELDS },
      },
    },
  })
}

/**
 * OpenAPI generation. Registered unconditionally so the generated document
 * always describes the plugins actually enabled on the instance — a doc
 * hand-written next to the instance drifts from it.
 *
 * The plugin's default Scalar reference page is disabled: the consuming API
 * already serves its own reference UI and merged document, and a second
 * reference app mounted under the auth base path would be an undocumented
 * endpoint. The schema endpoint the plugin adds is skipped by better-auth's
 * own generator, so it never appears in the document either.
 */
export function buildOpenApiPlugin(): BetterAuthPlugin {
  return openAPI({ disableDefaultReference: true }) as unknown as BetterAuthPlugin
}

/**
 * The full plugin list for an Abugida auth instance, in registration order.
 * Pure (given a config) so it can be asserted in unit tests without
 * constructing a live better-auth instance.
 */
export function buildServerPlugins(config: AuthConfig): BetterAuthPlugin[] {
  const twoFactorPlugin = buildTwoFactorPlugin(config)

  return [
    ...buildTelegramPlugins(config),
    ...buildTokenPlugins(config),
    ...(twoFactorPlugin ? [twoFactorPlugin] : []),
    buildOrganizationPlugin(config),
    // Last: it documents the plugins above, so it must be registered after
    // them for the generated document to include their endpoints.
    buildOpenApiPlugin(),
  ]
}

export type { TwoFactorConfig }
