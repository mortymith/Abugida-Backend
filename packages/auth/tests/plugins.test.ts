import { describe, expect, it } from 'bun:test'
import {
  buildOrganizationPlugin,
  buildServerPlugins,
  buildTwoFactorPlugin,
  ORGANIZATION_ADDITIONAL_FIELDS,
} from '../src'
import { buildClientPlugins } from '../src/client/plugins'
import type { AuthConfig } from '../src/core/types'

function baseConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    environment: 'development',
    baseUrl: 'http://localhost:3000',
    basePath: '/auth',
    secret: 'a'.repeat(32),
    database: {
      db: {},
      schema: { user: {}, session: {}, account: {}, verification: {} },
      provider: 'pg',
    },
    providers: { google: { clientId: 'id.apps.googleusercontent.com', clientSecret: 'secret' } },
    ...overrides,
  }
}

describe('server plugin registry', () => {
  it('always registers the organization plugin, even with no organization config', () => {
    const ids = buildServerPlugins(baseConfig()).map((plugin) => plugin.id)
    expect(ids).toContain('organization')
  })

  it('registers Telegram first when Telegram OIDC is configured', () => {
    const ids = buildServerPlugins(
      baseConfig({
        providers: { telegram: { clientId: '123456789', clientSecret: 'shh-its-a-secret' } },
      }),
    ).map((plugin) => plugin.id)

    expect(ids[0]).toBe('telegram')
    expect(ids).toContain('organization')
  })

  it('registers JWT and bearer plugins only when token issuance is configured', () => {
    expect(buildServerPlugins(baseConfig()).map((plugin) => plugin.id)).not.toContain('jwt')

    const ids = buildServerPlugins(baseConfig({ tokens: { audience: 'abugida' } })).map(
      (plugin) => plugin.id,
    )
    expect(ids).toContain('jwt')
    expect(ids).toContain('bearer')
  })

  it('places two-factor before organization, after the provider plugins, and OpenAPI last', () => {
    const ids = buildServerPlugins(
      baseConfig({
        providers: { telegram: { clientId: '123456789', clientSecret: 'shh-its-a-secret' } },
        tokens: { audience: 'abugida' },
        twoFactor: { issuer: 'Abugida Academy' },
      }),
    ).map((plugin) => plugin.id)

    // OpenAPI documents the plugins above it, so it is always registered last.
    expect(ids).toEqual(['telegram', 'jwt', 'bearer', 'two-factor', 'organization', 'open-api'])
  })

  it('omits two-factor when no policy is supplied', () => {
    expect(buildTwoFactorPlugin(baseConfig())).toBeNull()
  })

  it('passes the account-lockout cooldown as durationSeconds, not lockDuration', () => {
    const plugin = buildTwoFactorPlugin(
      baseConfig({
        twoFactor: {
          issuer: 'Abugida Academy',
          twoFactorCookieMaxAge: 600,
          trustDeviceMaxAge: 2_592_000,
          accountLockout: { maxFailedAttempts: 5, durationSeconds: 900 },
        },
      }),
    ) as unknown as { options: Record<string, unknown> }

    expect(plugin.options).toMatchObject({
      issuer: 'Abugida Academy',
      // The platform has no passwords: enrolment must not demand one.
      allowPasswordless: true,
      twoFactorCookieMaxAge: 600,
      trustDeviceMaxAge: 2_592_000,
      accountLockout: { maxFailedAttempts: 5, durationSeconds: 900 },
    })
  })

  it('declares the useCase organization field required, matching the database column', () => {
    const plugin = buildOrganizationPlugin(baseConfig()) as unknown as {
      schema: { organization: { fields: Record<string, { required: boolean; input: boolean }> } }
    }

    expect(ORGANIZATION_ADDITIONAL_FIELDS.useCase.required).toBe(true)
    expect(plugin.schema.organization.fields.useCase).toEqual({
      type: 'string',
      required: true,
      input: true,
    })
  })

  it('ignores an additionalPlugins escape hatch, if one is passed at runtime', () => {
    const plugin = { id: 'smuggled-plugin' }
    const config = { ...baseConfig(), additionalPlugins: [plugin] } as AuthConfig

    expect(buildServerPlugins(config).map((entry) => entry.id)).not.toContain('smuggled-plugin')
  })
})

describe('client plugin registry', () => {
  it('mirrors the server registry order', () => {
    expect(buildClientPlugins().map((plugin) => plugin.id)).toEqual(['organization', 'two-factor'])
  })

  it('exposes the organization and two-factor routes the server serves', () => {
    const [organization, twoFactor] = buildClientPlugins() as unknown as Array<{
      pathMethods?: Record<string, unknown>
      getActions?: (key: string) => Record<string, unknown>
    }>

    expect(Object.keys(organization.getActions?.('$infer') ?? {}).length).toBeGreaterThan(0)
    expect(Object.keys(twoFactor.pathMethods ?? {})).not.toHaveLength(0)
  })
})
