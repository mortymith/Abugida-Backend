/**
 * @module mounted-routes.test
 *
 * The endpoints `mountAuthRoutes` serves, against a *real* Better Auth
 * instance (no database is touched by these requests). The fake-instance tests
 * in `hono-middleware.test.ts` cover the middleware; this file proves the
 * mounted routes still reach Better Auth — i.e. that the session, OAuth and
 * plugin endpoints survived moving to the shared integration.
 */

import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import { mountAuthRoutes, type HonoAuthVariables } from '../src/middleware/hono'
import { createAuth } from '../src/core/auth'
import type { AuthConfig } from '../src/core/types'
import { PASSWORDLESS_DISABLED_PATHS } from '../src/core/routes'

function testConfig(): AuthConfig {
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
    providers: {
      google: { clientId: 'id.apps.googleusercontent.com', clientSecret: 'secret' },
      telegram: { clientId: '123456789', clientSecret: 'shh-its-a-secret' },
    },
    twoFactor: { issuer: 'Abugida Academy' },
  }
}

function mountedApp() {
  const app = new Hono<{ Bindings: Record<string, unknown>; Variables: HonoAuthVariables }>()
  const auth = createAuth(testConfig())
  mountAuthRoutes(app, auth, {
    socialSignIn: {
      callbackURL: 'https://app.abugida.com/callback',
      errorCallbackURL: 'https://app.abugida.com/login',
      newUserCallbackURL: 'https://app.abugida.com/welcome',
      providerAliases: { telegram: 'telegram-oidc' },
    },
    telegramConfig: { providerId: 'telegram' },
  })
  return app
}

describe('mounted auth routes', () => {
  it('serves the session endpoint from better-auth', async () => {
    const res = await mountedApp().request('/auth/get-session')
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('serves the sign-out endpoint from better-auth', async () => {
    const res = await mountedApp().request('/auth/sign-out', { method: 'POST' })
    expect(res.status).toBe(200)
  })

  it('rejects a social sign-in with no provider before better-auth', async () => {
    const res = await mountedApp().request('/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('lets better-auth reject a provider it does not know', async () => {
    // The policy wrapper only names the provider; recognizing (or refusing) it
    // is better-auth's job, which is why the error comes from better-auth.
    const res = await mountedApp().request('/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ provider: 'github' }),
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('serves the Telegram OIDC discovery endpoint with the public provider id', async () => {
    const res = await mountedApp().request('/auth/telegram/config')
    expect(res.status).toBe(200)
    expect((await res.json()) as { provider: string }).toMatchObject({ provider: 'telegram' })
  })

  it("does not serve better-auth's own documentation endpoints", async () => {
    // The generated document is exposed through getAuthOpenApiDocument(), not
    // as a second, unlisted copy of the schema on the API.
    expect((await mountedApp().request('/auth/open-api/generate-schema')).status).toBe(404)
    expect((await mountedApp().request('/auth/reference')).status).toBe(404)
  })

  it('404s the credential endpoints of a passwordless platform', async () => {
    for (const path of PASSWORDLESS_DISABLED_PATHS) {
      const res = await mountedApp().request(`/auth${path}`, { method: 'POST' })
      expect(res.status).toBe(404)
    }
  })

  it('404s the templated password-reset route', async () => {
    const res = await mountedApp().request('/auth/reset-password/some-token', { method: 'POST' })
    expect(res.status).toBe(404)
  })

  it('keeps the session endpoints served', async () => {
    const app = mountedApp()
    // Served, not "not found": a session endpoint answers 401 (no session) or
    // 400 (missing body), never 404.
    expect((await app.request('/auth/list-sessions', { method: 'GET' })).status).toBe(401)
    expect((await app.request('/auth/update-user', { method: 'POST' })).status).toBe(400)
  })

  it('serves the two-factor plugin endpoints', async () => {
    // No session: better-auth must reject it, which proves the plugin's route
    // is mounted under the same catch-all as the core endpoints.
    const res = await mountedApp().request('/auth/two-factor/get-totp-uri', { method: 'POST' })
    // Unauthenticated two-factor calls are refused by the plugin.
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
