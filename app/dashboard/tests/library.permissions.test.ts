import { describe, expect, test } from 'bun:test'
import {
  canEditLibrary,
  canViewLibrary,
  LIBRARY_VIEW_ROLES,
  LIBRARY_WRITE_ROLES,
} from '#/features/library/library.permissions'
import { PLATFORM_ROLES } from '#/features/auth/auth.roles'
import type { PlatformRole } from '#/features/auth/auth.roles'

/**
 * The permission matrix is enforced twice on purpose: server-side by
 * `requireLibraryWriteRole`, and here for rendering. The regression this guards
 * is the S-3.3 detail page and the S-3.6 editor rendering write controls for
 * Reviewer/Viewer, which the server then rejected with FORBIDDEN — and
 * `getAssetVersionsImpl` gating read-only version history behind the write
 * role, leaving Reviewer/Viewer with a silently empty history.
 */
describe('Content Library permissions (spec 05 / spec 11 matrix)', () => {
  test('Admin and Editor have full access', () => {
    for (const role of ['admin', 'editor'] as const) {
      expect(canViewLibrary(role)).toBe(true)
      expect(canEditLibrary(role)).toBe(true)
    }
  })

  test('Reviewer and Viewer can view but never write', () => {
    for (const role of ['reviewer', 'viewer'] as const) {
      expect(canViewLibrary(role)).toBe(true)
      expect(canEditLibrary(role)).toBe(false)
    }
  })

  test('Support has no access to the module', () => {
    expect(canViewLibrary('support')).toBe(false)
    expect(canEditLibrary('support')).toBe(false)
  })

  test('the write set is exactly the authoring set', () => {
    expect(LIBRARY_WRITE_ROLES).toEqual(['admin', 'editor'])
  })

  test('every declared role is classified, and write implies view', () => {
    for (const role of PLATFORM_ROLES as readonly PlatformRole[]) {
      expect(typeof canViewLibrary(role)).toBe('boolean')
      if (canEditLibrary(role)) expect(canViewLibrary(role)).toBe(true)
    }
    expect(LIBRARY_VIEW_ROLES).toContain('admin')
    expect(LIBRARY_VIEW_ROLES).toContain('viewer')
    expect(LIBRARY_VIEW_ROLES).not.toContain('support')
  })

  test('view and write lists are deduplicated and free of unknown roles', () => {
    expect(new Set(LIBRARY_VIEW_ROLES).size).toBe(LIBRARY_VIEW_ROLES.length)
    expect(new Set(LIBRARY_WRITE_ROLES).size).toBe(LIBRARY_WRITE_ROLES.length)
    for (const role of [...LIBRARY_VIEW_ROLES, ...LIBRARY_WRITE_ROLES]) {
      expect(PLATFORM_ROLES).toContain(role)
    }
  })
})
