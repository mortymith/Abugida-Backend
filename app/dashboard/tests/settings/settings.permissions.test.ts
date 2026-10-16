import { describe, expect, test } from 'bun:test'
import {
  findManagerConflicts,
  resolveEffectiveMatrices,
  sanitizeMatrix,
  validateAdminMatrix,
} from '#/features/settings/settings.permissions'
import { BUILT_IN_ROLE_PERMISSIONS } from '#/features/settings/settings.constants'
import type { PermissionMatrix } from '#/features/settings/settings.constants'

describe('sanitizeMatrix', () => {
  test('drops unknown modules and capabilities', () => {
    const result = sanitizeMatrix({
      Courses: ['view', 'edit', 'fly'],
      Atlantis: ['view'],
      Billing: 'not-an-array',
    })
    expect(result).toEqual({ Courses: ['view', 'edit'] })
  })

  test('deduplicates capabilities and drops empty modules', () => {
    const result = sanitizeMatrix({ Courses: ['view', 'view', 'edit'], Billing: [] })
    expect(result).toEqual({ Courses: ['view', 'edit'] })
  })

  test('non-object input yields empty matrix', () => {
    expect(sanitizeMatrix(null)).toEqual({})
    expect(sanitizeMatrix('x')).toEqual({})
  })
})

describe('validateAdminMatrix (built-in lock)', () => {
  test('full admin matrix passes', () => {
    expect(validateAdminMatrix(BUILT_IN_ROLE_PERMISSIONS['admin'])).toBeNull()
  })

  test('removing write access from any module is rejected', () => {
    const withoutBilling: PermissionMatrix = {
      ...BUILT_IN_ROLE_PERMISSIONS['admin'],
      Billing: ['view'],
    }
    expect(validateAdminMatrix(withoutBilling)).toContain('Billing')

    const withoutSettings: PermissionMatrix = {
      ...BUILT_IN_ROLE_PERMISSIONS['admin'],
      Settings: [],
    }
    expect(validateAdminMatrix(withoutSettings)).toContain('Settings')
  })
})

describe('findManagerConflicts (zero-manager rule)', () => {
  const counts = { admin: 1, editor: 2 }

  test('no conflicts when a role keeps write access', () => {
    const proposed = resolveEffectiveMatrices({})
    expect(findManagerConflicts(proposed, counts)).toEqual([])
  })

  test('flags when nobody can manage Settings', () => {
    const proposed = resolveEffectiveMatrices({
      admin: { ...BUILT_IN_ROLE_PERMISSIONS['admin'], Settings: ['view'] },
    })
    const conflicts = findManagerConflicts(proposed, counts)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toContain('Settings')
  })

  test('flags both modules when all write cells are view', () => {
    const proposed = resolveEffectiveMatrices({
      admin: { ...BUILT_IN_ROLE_PERMISSIONS['admin'], Settings: ['view'], Billing: ['view'] },
    })
    const conflicts = findManagerConflicts(proposed, counts)
    expect(conflicts).toHaveLength(2)
  })

  test('a role with zero members cannot satisfy management', () => {
    const proposed = resolveEffectiveMatrices({
      admin: { ...BUILT_IN_ROLE_PERMISSIONS['admin'], Billing: ['view'] },
      helper: { Billing: ['edit'] },
    })
    const conflicts = findManagerConflicts(proposed, { admin: 1 })
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toContain('Billing')
  })
})

describe('resolveEffectiveMatrices', () => {
  test('built-in roles default to the spec 11 matrix', () => {
    const resolved = resolveEffectiveMatrices({})
    expect(resolved['admin']).toEqual(BUILT_IN_ROLE_PERMISSIONS['admin'])
    expect(resolved['viewer']).toEqual(BUILT_IN_ROLE_PERMISSIONS['viewer'])
  })

  test('a saved row overrides the default', () => {
    const resolved = resolveEffectiveMatrices({
      viewer: { Courses: ['view', 'edit'] },
    })
    expect(resolved['viewer']).toEqual({ Courses: ['view', 'edit'] })
    // Other roles keep defaults.
    expect(resolved['support']).toEqual(BUILT_IN_ROLE_PERMISSIONS['support'])
  })

  test('custom (non built-in) roles pass through', () => {
    const resolved = resolveEffectiveMatrices({
      'content-manager': { Courses: ['view', 'edit'] },
    })
    expect(resolved['content-manager']).toEqual({ Courses: ['view', 'edit'] })
  })
})
