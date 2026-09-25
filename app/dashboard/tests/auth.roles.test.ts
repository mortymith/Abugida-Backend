import { describe, expect, test } from 'bun:test'
import {
  hasAtLeastRole,
  mapBetterAuthRoleToPlatformRole,
  REVENUE_ROLES,
  ROLE_PRIORITY,
} from '#/features/auth/auth.roles'

describe('mapBetterAuthRoleToPlatformRole', () => {
  test('owner and admin map to platform admin', () => {
    expect(mapBetterAuthRoleToPlatformRole('owner')).toBe('admin')
    expect(mapBetterAuthRoleToPlatformRole('admin')).toBe('admin')
  })

  test('platform roles map verbatim', () => {
    expect(mapBetterAuthRoleToPlatformRole('editor')).toBe('editor')
    expect(mapBetterAuthRoleToPlatformRole('reviewer')).toBe('reviewer')
    expect(mapBetterAuthRoleToPlatformRole('viewer')).toBe('viewer')
    expect(mapBetterAuthRoleToPlatformRole('support')).toBe('support')
  })

  test('comma-separated roles resolve to the highest privilege', () => {
    expect(mapBetterAuthRoleToPlatformRole('viewer,editor')).toBe('editor')
    expect(mapBetterAuthRoleToPlatformRole('editor,admin')).toBe('admin')
    expect(mapBetterAuthRoleToPlatformRole('support,viewer')).toBe('support')
  })

  test('unknown or missing roles fall back to viewer (least privilege)', () => {
    expect(mapBetterAuthRoleToPlatformRole('member')).toBe('viewer')
    expect(mapBetterAuthRoleToPlatformRole('wizard')).toBe('viewer')
    expect(mapBetterAuthRoleToPlatformRole(null)).toBe('viewer')
    expect(mapBetterAuthRoleToPlatformRole(undefined)).toBe('viewer')
    expect(mapBetterAuthRoleToPlatformRole('')).toBe('viewer')
  })

  test('case-insensitive matching', () => {
    expect(mapBetterAuthRoleToPlatformRole('Admin')).toBe('admin')
    expect(mapBetterAuthRoleToPlatformRole(' EDITOR ')).toBe('editor')
  })
})

describe('role priority', () => {
  test('admin outranks everything; viewer is the floor', () => {
    expect(ROLE_PRIORITY.admin).toBeGreaterThan(ROLE_PRIORITY.editor)
    expect(ROLE_PRIORITY.editor).toBeGreaterThan(ROLE_PRIORITY.support)
    expect(ROLE_PRIORITY.support).toBeGreaterThan(ROLE_PRIORITY.viewer)
  })

  test('revenue gate covers admin and editor only (spec 11)', () => {
    expect(REVENUE_ROLES).toEqual(['admin', 'editor'])
  })

  test('hasAtLeastRole enforces the matrix boundaries', () => {
    expect(hasAtLeastRole('admin', 'editor')).toBe(true)
    expect(hasAtLeastRole('editor', 'editor')).toBe(true)
    expect(hasAtLeastRole('support', 'editor')).toBe(false)
    expect(hasAtLeastRole('viewer', 'viewer')).toBe(true)
    expect(hasAtLeastRole('viewer', 'support')).toBe(false)
  })
})
