/**
 * @module routes.test
 *
 * The served-surface policy: which Better Auth paths this platform refuses and
 * which of Better Auth's own documentation endpoints are not served. Pure
 * predicates, so no instance is needed.
 */

import { describe, expect, it } from 'bun:test'
import {
  isOpenApiPluginPath,
  isPasswordlessDisabledPath,
  normalizeAuthBasePath,
  PASSWORDLESS_DISABLED_PATHS,
} from '../src/core/routes'

describe('normalizeAuthBasePath', () => {
  it('strips trailing slashes and guarantees a leading slash', () => {
    expect(normalizeAuthBasePath('/auth')).toBe('/auth')
    expect(normalizeAuthBasePath('/auth/')).toBe('/auth')
    expect(normalizeAuthBasePath('auth')).toBe('/auth')
    expect(normalizeAuthBasePath('')).toBe('')
  })
})

describe('isPasswordlessDisabledPath', () => {
  it("refuses every credential path listed for better-auth's disabledPaths", () => {
    for (const entry of PASSWORDLESS_DISABLED_PATHS) {
      expect(isPasswordlessDisabledPath(`/auth${entry}`)).toBe(true)
    }
  })

  it('refuses the templated password-reset route, which disabledPaths cannot express', () => {
    expect(isPasswordlessDisabledPath('/auth/reset-password/abc123')).toBe(true)
  })

  it('keeps the session and social endpoints', () => {
    for (const path of [
      '/auth/get-session',
      '/auth/sign-out',
      '/auth/list-sessions',
      '/auth/revoke-session',
      '/auth/update-user',
      '/auth/delete-user',
      '/auth/account-info',
      '/auth/sign-in/social',
      '/auth/session/refresh',
    ]) {
      expect(isPasswordlessDisabledPath(path)).toBe(false)
    }
  })

  it('matches only under the auth base path', () => {
    expect(isPasswordlessDisabledPath('/reset-password')).toBe(false)
    expect(isPasswordlessDisabledPath('/api/auth/change-password')).toBe(false)
    expect(isPasswordlessDisabledPath('/api/auth/change-password', '/api/auth')).toBe(true)
  })

  it('does not match a path that merely starts with the same characters', () => {
    expect(isPasswordlessDisabledPath('/auth/change-password-help')).toBe(false)
  })
})

describe('isOpenApiPluginPath', () => {
  it('recognizes the plugin documentation paths under a base path', () => {
    expect(isOpenApiPluginPath('/auth/open-api/generate-schema')).toBe(true)
    expect(isOpenApiPluginPath('/auth/reference')).toBe(true)
    expect(isOpenApiPluginPath('/auth/get-session')).toBe(false)
    expect(isOpenApiPluginPath('/open-api/generate-schema')).toBe(false)
    expect(isOpenApiPluginPath('/api/auth/open-api/generate-schema', '/api/auth')).toBe(true)
    expect(isOpenApiPluginPath('/auth/open-api-reports', '/auth')).toBe(false)
  })
})
