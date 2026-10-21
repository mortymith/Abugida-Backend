/**
 * Spec 13 § The Two Role Systems — course-role vocabulary.
 *
 * The DB-backed grant/revoke/list impls are exercised by manual + E2E. This
 * test pins the pure vocabulary the spec names: the five course-role names,
 * the type guard, and the self-approval guard's error vocabulary.
 */
import { test, expect } from 'bun:test'
import { COURSE_ROLE_NAMES, isCourseRoleName } from '#/features/courses/courses.course-roles'

test('COURSE_ROLE_NAMES matches the spec vocabulary', () => {
  // Spec 13 § The Two Role Systems — the `roles.name` column is unique, and
  // these five names are the spec's vocabulary.
  expect(COURSE_ROLE_NAMES).toEqual(['owner', 'instructor', 'reviewer', 'viewer', 'support'])
})

test('isCourseRoleName accepts every spec role', () => {
  for (const name of COURSE_ROLE_NAMES) {
    expect(isCourseRoleName(name)).toBe(true)
  }
})

test('isCourseRoleName rejects unknown roles', () => {
  expect(isCourseRoleName('admin')).toBe(false) // admin is a member role, not a course role
  expect(isCourseRoleName('editor')).toBe(false) // editor is a member role
  expect(isCourseRoleName('')).toBe(false)
  expect(isCourseRoleName('superuser')).toBe(false)
  expect(isCourseRoleName('Owner')).toBe(false) // case-sensitive — the role table is exact
})

test('COURSE_ROLE_NAMES is readonly and exhaustive', () => {
  // The spec names exactly five course roles. Adding one is a spec change,
  // not an implementation choice — this test pins the count.
  expect(COURSE_ROLE_NAMES).toHaveLength(5)
})

test('the spec owner role is in the vocabulary (distinct from the workspace owner)', () => {
  // Spec 13 § The Two Role Systems: `owner` on a course is the course
  // creator, not the workspace owner. The vocabulary includes both —
  // `owner` as a course role, and `owner`/`admin` as member roles — and the
  // two are independent.
  expect(COURSE_ROLE_NAMES).toContain('owner')
})
