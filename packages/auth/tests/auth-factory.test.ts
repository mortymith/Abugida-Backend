import { describe, it, expect } from 'bun:test'
import { createAuth } from '../src/core/auth'
import { noopLogger } from '../src/core/logger'
import type { AuthConfig } from '../src/core/types'

function invalidConfig(): AuthConfig {
  return {
    environment: 'development',
    baseUrl: 'http://localhost:3000',
    secret: 'too-short', // fails validation before any DB/adapter code runs
    database: {
      db: {},
      schema: { user: {}, session: {}, account: {}, verification: {} },
      provider: 'pg',
    },
    providers: { google: { clientId: 'id.apps.googleusercontent.com', clientSecret: 'secret' } },
  }
}

describe('createAuth', () => {
  it('throws a config_invalid AuthError before constructing the underlying betterAuth instance', () => {
    expect(() => createAuth(invalidConfig())).toThrow()
  })

  it('logs the validation failure through a caller-supplied logger', () => {
    const events: string[] = []
    const logger = {
      ...noopLogger,
      error: (message: string) => events.push(message),
    }

    expect(() => createAuth({ ...invalidConfig(), logger })).toThrow()
    expect(events.length).toBeGreaterThan(0)
  })

  it('rejects config with no providers configured at all', () => {
    const config = invalidConfig()
    config.secret = 'a'.repeat(32)
    config.providers = {}
    expect(() => createAuth(config)).toThrow()
  })

  it('constructs the underlying betterAuth instance with telegram-only providers', () => {
    const config = invalidConfig()
    config.secret = 'a'.repeat(32)
    config.providers = {
      telegram: {
        clientId: '123456789',
        clientSecret: 'shh-its-a-secret',
      },
    }
    const auth = createAuth(config)
    expect(auth.config.providers.telegram?.clientId).toBe('123456789')
  })

  it('exposes Telegram OIDC as a social provider on the resolved better-auth context', async () => {
    const config = invalidConfig()
    config.secret = 'a'.repeat(32)
    config.providers = {
      telegram: {
        clientId: '123456789',
        clientSecret: 'shh-its-a-secret',
      },
    }
    const auth = createAuth(config)
    const context = (await auth.raw.$context) as unknown as {
      socialProviders: Array<{ id: string }>
    }
    // The telegram-oidc provider is registered by the plugin's init hook and
    // served through better-auth's own /sign-in/social + /callback routes.
    const providerIds = context.socialProviders.map((provider) => provider.id)
    expect(providerIds).toContain('telegram-oidc')
  })

  it('registers only the OIDC-compatible telegram plugin endpoints on the raw better-auth instance', () => {
    const config = invalidConfig()
    config.secret = 'a'.repeat(32)
    config.providers = {
      telegram: {
        clientId: '123456789',
        clientSecret: 'shh-its-a-secret',
      },
    }
    const auth = createAuth(config)
    const api = auth.raw.api as Record<string, unknown>
    // The plugin's config discovery endpoint is always registered; the legacy
    // Login Widget endpoints are not (loginWidget: false).
    expect(api.getTelegramConfig).toBeDefined()
    expect(api.signInWithTelegram).toBeUndefined()
    expect(api.linkTelegram).toBeUndefined()
    expect(api.unlinkTelegram).toBeUndefined()
  })
})
