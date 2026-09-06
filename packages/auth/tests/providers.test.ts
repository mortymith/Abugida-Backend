import { describe, it, expect } from 'bun:test'
import { googleProvider } from '../src/providers/google'
import { buildTelegramPlugins, validateTelegramCredentials } from '../src/providers/telegram'
import type { GoogleProviderCredentials, TelegramProviderCredentials } from '../src/core/types'
import type { AuthConfig } from '../src/core/types'

const validGoogle: GoogleProviderCredentials = {
  clientId: '1234567890-abcdefg.apps.googleusercontent.com',
  clientSecret: 'shh-its-a-secret',
}

const validTelegram: TelegramProviderCredentials = {
  clientId: '123456789',
  clientSecret: 'shh-its-a-secret',
}

function baseConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    environment: 'development',
    baseUrl: 'http://localhost:3000',
    secret: 'a'.repeat(32),
    database: {
      db: {},
      schema: { user: {}, session: {}, account: {}, verification: {} },
      provider: 'pg',
    },
    providers: {},
    ...overrides,
  }
}

describe('googleProvider.validateCredentials', () => {
  it('accepts a well-formed credential set', () => {
    expect(() => googleProvider.validateCredentials(validGoogle)).not.toThrow()
  })

  it('rejects a missing clientSecret', () => {
    expect(() => googleProvider.validateCredentials({ ...validGoogle, clientSecret: '' })).toThrow()
  })

  it('rejects a clientId not shaped like a Google OAuth client id', () => {
    expect(() =>
      googleProvider.validateCredentials({ ...validGoogle, clientId: 'not-a-google-id' }),
    ).toThrow()
  })
})

describe('googleProvider.toBetterAuthConfig', () => {
  it('defaults accessType to offline so refresh tokens are issued', () => {
    const config = googleProvider.toBetterAuthConfig(validGoogle)
    expect(config.accessType).toBe('offline')
  })

  it('respects an explicit accessType override', () => {
    const config = googleProvider.toBetterAuthConfig({ ...validGoogle, accessType: 'online' })
    expect(config.accessType).toBe('online')
  })

  it('forwards additionalClientIds for multi-client (web + mobile) setups', () => {
    const config = googleProvider.toBetterAuthConfig({
      ...validGoogle,
      additionalClientIds: ['ios-client-id', 'android-client-id'],
    })
    expect(config.additionalClientIds).toEqual(['ios-client-id', 'android-client-id'])
  })
})

describe('validateTelegramCredentials', () => {
  it('accepts a well-formed credential set', () => {
    expect(() => validateTelegramCredentials(validTelegram)).not.toThrow()
  })

  it('rejects a missing clientId', () => {
    expect(() => validateTelegramCredentials({ ...validTelegram, clientId: '' })).toThrow()
  })

  it('rejects a missing clientSecret', () => {
    expect(() => validateTelegramCredentials({ ...validTelegram, clientSecret: '' })).toThrow()
  })

  it('rejects empty scope entries', () => {
    expect(() =>
      validateTelegramCredentials({ ...validTelegram, scopes: ['profile', '  '] }),
    ).toThrow()
  })
})

describe('buildTelegramPlugins', () => {
  it('returns an empty array when Telegram is not configured', () => {
    expect(buildTelegramPlugins(baseConfig())).toEqual([])
  })

  it('builds a plugin instance with the telegram id when configured', () => {
    const plugins = buildTelegramPlugins(baseConfig({ providers: { telegram: validTelegram } }))
    expect(plugins).toHaveLength(1)
    expect(plugins[0]!.id).toBe('telegram')
  })

  it('registers the Telegram OIDC social provider during plugin init', () => {
    const plugins = buildTelegramPlugins(baseConfig({ providers: { telegram: validTelegram } }))
    const plugin = plugins[0]!
    expect(plugin.init).toBeDefined()
    const result = plugin.init!({ socialProviders: [] } as never) as {
      context: { socialProviders: Array<{ id: string }> }
    }
    const ids = result.context.socialProviders.map((provider) => provider.id)
    expect(ids).toContain('telegram-oidc')
  })

  it('never registers the legacy Login Widget or Mini App endpoints', () => {
    const plugins = buildTelegramPlugins(baseConfig({ providers: { telegram: validTelegram } }))
    const plugin = plugins[0]!
    const endpoints = plugin.endpoints as Record<string, unknown>
    expect(endpoints.signInWithTelegram).toBeUndefined()
    expect(endpoints.linkTelegram).toBeUndefined()
    expect(endpoints.unlinkTelegram).toBeUndefined()
    expect(endpoints.signInWithMiniApp).toBeUndefined()
    expect(endpoints.validateMiniApp).toBeUndefined()
    // Only the plugin's config discovery endpoint remains.
    expect(endpoints.getTelegramConfig).toBeDefined()
  })

  it('registers no plugin rate limits (widget/miniapp limits are widget-only)', () => {
    const plugins = buildTelegramPlugins(baseConfig({ providers: { telegram: validTelegram } }))
    expect(plugins[0]!.rateLimit).toEqual([])
  })

  it('contributes no extra user/account schema fields', () => {
    const plugins = buildTelegramPlugins(baseConfig({ providers: { telegram: validTelegram } }))
    expect(plugins[0]!.schema).toBeUndefined()
  })
})
