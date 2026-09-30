/**
 * @module openapi-document.test
 * @description The published OpenAPI document (`GET /docs`).
 *
 * The `/auth/*` paths are generated from the live Better Auth instance by
 * `@abugida/auth` and merged into the API's own document. These tests assert
 * the merged result: the auth endpoints are present under the right prefix,
 * schemas and security requirements resolve, and the host document's identity
 * is untouched.
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import { OpenAPIHono, createRoute, z, extendZodWithOpenApi } from '@hono/zod-openapi'
import type { AppEnv } from '@/middleware/types'
import { registerSystemDocumentation } from '@/modules/system'
import type { AuthInstance } from '@abugida/auth'

extendZodWithOpenApi(z)

interface OpenApiDocument {
  paths: Record<string, Record<string, { tags?: string[]; security?: unknown[] }>>
  components: {
    schemas: Record<string, unknown>
    securitySchemes: Record<string, unknown>
  }
  info: { title: string }
  servers: Array<{ url: string }>
  tags: Array<{ name: string }>
}

let document: OpenApiDocument

/** Every `$ref` target in the document, e.g. `#/components/schemas/User`. */
function refsIn(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const entry of value) refsIn(entry, found)
  } else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (key === '$ref' && typeof entry === 'string') found.push(entry)
      else refsIn(entry, found)
    }
  }
  return found
}

beforeAll(async () => {
  // The shared auth instance logs through the observability logger, which
  // throws until init() has run — the same order app.ts uses.
  const { init } = await import('@/config/observability')
  await init()
  const { createAuthInstance } = await import('@/config/auth')
  const auth: AuthInstance = createAuthInstance()

  const app = new OpenAPIHono<AppEnv>()
  // One hand-written route, so the document has host content to merge into.
  const probe = createRoute({
    method: 'get',
    path: '/probe',
    tags: ['System'],
    security: [{ apiKeyHeader: [] }],
    responses: {
      200: {
        description: 'Probe',
        content: { 'application/json': { schema: z.object({ ok: z.boolean() }) } },
      },
    },
  })
  app.openapi(probe, (c) => c.json({ ok: true }, 200))
  registerSystemDocumentation(app, auth)

  const res = await app.request('/docs')
  expect(res.status).toBe(200)
  document = (await res.json()) as OpenApiDocument
})

describe('GET /docs', () => {
  it('keeps the host document identity and servers', () => {
    expect(document.info.title).toBe('Abugida Application API')
    expect(document.servers.length).toBeGreaterThan(0)
  })

  it('documents the auth endpoints the shared instance actually serves', () => {
    for (const path of [
      '/auth/sign-in/social',
      '/auth/callback/{id}',
      '/auth/get-session',
      '/auth/sign-out',
      '/auth/telegram/config',
      '/auth/two-factor/verify-totp',
      '/auth/organization/list',
    ]) {
      expect(document.paths[path]).toBeDefined()
    }
  })

  it('documents the session refresh endpoint mounted by the shared package', () => {
    expect(document.paths['/auth/session/refresh']?.post).toBeDefined()
  })

  it('does not document the credential endpoints of a passwordless platform', () => {
    for (const path of [
      '/auth/sign-in/email',
      '/auth/sign-up/email',
      '/auth/change-password',
      '/auth/change-email',
      '/auth/request-password-reset',
      '/auth/reset-password/{token}',
      '/auth/send-verification-email',
      '/auth/verify-email',
      '/auth/verify-password',
    ]) {
      expect(document.paths[path]).toBeUndefined()
    }
    // …while the session endpoints that do work stay documented.
    expect(document.paths['/auth/list-sessions']).toBeDefined()
    expect(document.paths['/auth/update-user']).toBeDefined()
  })

  it('leaves no auth path unprefixed and no host path duplicated', () => {
    const paths = Object.keys(document.paths)
    expect(paths.some((path) => path === '/sign-in/social')).toBe(false)
    expect(paths).toContain('/probe')
    expect(new Set(paths).size).toBe(paths.length)
  })

  it("does not document better-auth's own documentation endpoints", () => {
    expect(Object.keys(document.paths).some((path) => path.includes('open-api'))).toBe(false)
    expect(Object.keys(document.paths).some((path) => path.includes('reference'))).toBe(false)
  })

  it("files the auth operations under the API's Auth tag", () => {
    expect(document.paths['/auth/sign-in/social']?.post?.tags).toEqual(['Auth'])
    expect(document.tags.map((tag) => tag.name)).toContain('Auth')
  })

  it('defines every security scheme it references, without duplicates', () => {
    const schemes = document.components.securitySchemes
    expect(Object.keys(schemes).sort()).toEqual(['Bearer', 'apiKeyHeader', 'sessionCookie'])
    expect(schemes.Bearer).toMatchObject({ type: 'http', scheme: 'bearer' })
    expect(schemes.apiKeyHeader).toMatchObject({ type: 'apiKey', in: 'header', name: 'X-API-Key' })
  })

  it("points auth operations at the API's own bearer scheme", () => {
    expect(document.paths['/auth/get-session']?.get?.security).toEqual([{ Bearer: [] }])
  })

  it('carries the auth database schemas', () => {
    expect(Object.keys(document.components.schemas)).toEqual(
      expect.arrayContaining(['User', 'Session', 'Account', 'Organization']),
    )
  })

  it('resolves every $ref in the document', () => {
    for (const ref of refsIn(document)) {
      const [prefix, group, name] = ref.replace(/^#\//, '').split('/')
      expect(prefix).toBe('components')
      const groupSchemas = document.components as unknown as Record<
        string,
        Record<string, unknown> | undefined
      >
      expect(groupSchemas[group]?.[name as string]).toBeDefined()
    }
  })
})
