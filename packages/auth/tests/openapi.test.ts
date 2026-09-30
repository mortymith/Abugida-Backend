/**
 * @module openapi.test
 *
 * The OpenAPI document is generated from the live Better Auth instance, so
 * these tests build a real (db-less) instance the same way an app does and
 * assert on what comes out: the endpoints the plugin registry enables, the
 * schemas, the security schemes — and the merge into a host document.
 */

import { describe, expect, it } from 'bun:test'
import { createAuth } from '../src/core/auth'
import { getAuthOpenApiDocument, mergeAuthOpenApiDocument } from '../src/core/openapi'
import { buildServerPlugins } from '../src/plugins/server'
import type { AuthConfig } from '../src/core/types'

function testConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
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
    ...overrides,
  }
}

function instance(overrides: Partial<AuthConfig> = {}) {
  return createAuth(testConfig(overrides))
}

describe('plugin registry', () => {
  it('registers the OpenAPI plugin so the document reflects the live instance', () => {
    expect(buildServerPlugins(testConfig()).map((plugin) => plugin.id)).toContain('open-api')
  })

  it('registers the OpenAPI plugin last, after the plugins it documents', () => {
    const ids = buildServerPlugins(testConfig()).map((plugin) => plugin.id)
    expect(ids[ids.length - 1]).toBe('open-api')
  })
})

describe('getAuthOpenApiDocument', () => {
  it('returns an OpenAPI 3.1 document', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    expect(doc.openapi.startsWith('3.1')).toBe(true)
    expect(Object.keys(doc.paths).length).toBeGreaterThan(0)
  })

  it('describes the core session and sign-in endpoints', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    expect(doc.paths['/sign-in/social']).toBeDefined()
    expect(doc.paths['/callback/{id}']).toBeDefined()
    expect(doc.paths['/get-session']).toBeDefined()
    expect(doc.paths['/sign-out']).toBeDefined()
  })

  it('describes the endpoints of the enabled plugins only', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    expect(doc.paths['/telegram/config']).toBeDefined()
    expect(doc.paths['/two-factor/verify-totp']).toBeDefined()
    expect(doc.paths['/organization/list']).toBeDefined()

    const withoutTokens = await getAuthOpenApiDocument(
      instance({ tokens: undefined, twoFactor: undefined }),
    )
    expect(withoutTokens.paths['/two-factor/verify-totp']).toBeUndefined()
    // Organizations are unconditional, so they stay either way.
    expect(withoutTokens.paths['/organization/list']).toBeDefined()
  })

  it('emits the schemas of the auth database tables', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    expect(Object.keys(doc.components.schemas)).toEqual(
      expect.arrayContaining([
        'User',
        'Session',
        'Account',
        'Organization',
        'Member',
        'Invitation',
      ]),
    )
  })

  it('declares a cookie and a bearer security scheme', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    expect(doc.components.securitySchemes.apiKeyCookie).toBeDefined()
    expect(doc.components.securitySchemes.bearerAuth).toBeDefined()
  })

  it("omits the plugin's own documentation endpoints", async () => {
    const doc = await getAuthOpenApiDocument(instance())
    expect(Object.keys(doc.paths).some((path) => path.includes('open-api'))).toBe(false)
    expect(Object.keys(doc.paths).some((path) => path.includes('reference'))).toBe(false)
  })

  it('does not document the credential endpoints of a passwordless platform', async () => {
    const doc = await getAuthOpenApiDocument(instance())

    // No email sign-in, sign-up, password or e-mail change/verification flow:
    // the platform signs in with Google or Telegram OIDC only — including the
    // templated reset route, which is why its template is in `disabledPaths`.
    for (const path of [
      '/sign-up/email',
      '/sign-in/email',
      '/change-password',
      '/change-email',
      '/request-password-reset',
      '/reset-password',
      '/reset-password/{token}',
      '/send-verification-email',
      '/verify-email',
      '/verify-password',
    ]) {
      expect(doc.paths[path]).toBeUndefined()
    }
  })

  it('still documents the session endpoints, which work from the cookie', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    for (const path of ['/get-session', '/sign-out', '/list-sessions', '/update-user']) {
      expect(doc.paths[path]).toBeDefined()
    }
  })

  it('returns paths relative to the auth base path, for the merge to prefix', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    expect(Object.keys(doc.paths).every((path) => path.startsWith('/'))).toBe(true)
    expect(Object.keys(doc.paths).some((path) => path.startsWith('/auth'))).toBe(false)
  })

  it('caches the generated document per instance', async () => {
    const auth = instance()
    const [first, second] = await Promise.all([
      getAuthOpenApiDocument(auth),
      getAuthOpenApiDocument(auth),
    ])
    expect(second).toBe(first)
    expect(await getAuthOpenApiDocument(auth)).toBe(first)
  })
})

describe('mergeAuthOpenApiDocument', () => {
  const hostDocument = () => ({
    openapi: '3.1.0',
    info: { title: 'Abugida', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3001' }],
    tags: [{ name: 'Users', description: 'Users' }],
    paths: { '/users/me': { get: { tags: ['Users'] } } },
    components: {
      schemas: { User: { type: 'object', description: 'host-owned' } },
      securitySchemes: { Bearer: { type: 'http', scheme: 'bearer' } },
    },
  })

  it('prefixes generated paths with the auth base path', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    const merged = mergeAuthOpenApiDocument(hostDocument(), doc, { tag: 'Auth' })

    expect(merged.paths?.['/auth/sign-in/social']).toBeDefined()
    expect(merged.paths?.['/auth/get-session']).toBeDefined()
    expect(merged.paths?.['/users/me']).toBeDefined()
  })

  it('documents the session refresh endpoint this package mounts itself', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    const merged = mergeAuthOpenApiDocument(hostDocument(), doc, { tag: 'Auth' })
    expect(merged.paths?.['/auth/session/refresh']?.post).toBeDefined()
  })

  it('honours a custom base path', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    const merged = mergeAuthOpenApiDocument(hostDocument(), doc, { basePath: '/api/v1/auth' })
    expect(merged.paths?.['/api/v1/auth/sign-in/social']).toBeDefined()
  })

  it('maps better-auth security schemes onto the host scheme names', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    const merged = mergeAuthOpenApiDocument(hostDocument(), doc, {
      tag: 'Auth',
      bearerSecurityScheme: 'Bearer',
      cookieSecurityScheme: 'sessionCookie',
    })

    const schemes = merged.components?.securitySchemes ?? {}
    expect(Object.keys(schemes)).toEqual(expect.arrayContaining(['Bearer', 'sessionCookie']))
    // No duplicate definition of the same mechanism.
    expect(schemes.bearerAuth).toBeUndefined()
    expect(schemes.apiKeyCookie).toBeUndefined()

    const security = merged.paths?.['/auth/get-session']?.get?.security
    expect(security).toEqual([{ Bearer: [] }])
    // The session/refresh endpoint this package mounts accepts either proof.
    const refreshSecurity = merged.paths?.['/auth/session/refresh']?.post?.security
    expect(refreshSecurity).toEqual([{ Bearer: [] }, { sessionCookie: [] }])
  })

  it('retags every auth operation with the requested tag', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    const merged = mergeAuthOpenApiDocument(hostDocument(), doc, { tag: 'Auth' })
    for (const path of ['/auth/sign-in/social', '/auth/session/refresh']) {
      const item = merged.paths?.[path]
      for (const operation of Object.values(item ?? {})) {
        expect((operation as { tags?: string[] }).tags).toEqual(['Auth'])
      }
    }
    expect(merged.tags).toEqual([{ name: 'Users', description: 'Users' }])
  })

  it('keeps the generated tags when no single tag is requested', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    const merged = mergeAuthOpenApiDocument(hostDocument(), doc)
    expect(merged.tags?.map((tag) => tag.name)).toContain('Default')
  })

  it('keeps the host info, servers and root security requirements', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    const merged = mergeAuthOpenApiDocument(
      { ...hostDocument(), security: [{ Bearer: [] }] },
      doc,
      { tag: 'Auth' },
    )
    expect(merged.info).toEqual(hostDocument().info)
    expect(merged.servers).toEqual(hostDocument().servers)
    expect(merged.security).toEqual([{ Bearer: [] }])
  })

  it('never redefines a schema the host already declares', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    const merged = mergeAuthOpenApiDocument(hostDocument(), doc, { tag: 'Auth' })
    expect(merged.components?.schemas?.User).toEqual({ type: 'object', description: 'host-owned' })
    expect(merged.components?.schemas?.Session).toBeDefined()
  })

  it('does not mutate the host document', async () => {
    const doc = await getAuthOpenApiDocument(instance())
    const host = hostDocument()
    const snapshot = structuredClone(host)
    mergeAuthOpenApiDocument(host, doc, { tag: 'Auth' })
    expect(host).toEqual(snapshot)
  })
})
