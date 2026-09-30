import { describe, expect, test } from 'bun:test'
import { SignupWorkspaceSchema, slugFromName } from '#/features/auth/schemas/auth.signup.schema'
import { PRIMARY_USE_CASES, normaliseUseCase } from '#/features/onboarding/onboarding.checklist'

/**
 * S-0.2 sign-up form contract.
 *
 * `slugFromName` drives the auto-filled subdomain, so a name that derives
 * something the schema then rejects would make the form look broken: the field
 * fills itself in and is immediately invalid.
 */

describe('slugFromName', () => {
  test('lowercases and hyphenates a workspace name', () => {
    expect(slugFromName('Abugida Academy Ethiopia')).toBe('abugida-academy-ethiopia')
  })

  test('strips characters a subdomain cannot hold', () => {
    expect(slugFromName('Café & Co. (Addis)')).toBe('cafe-co-addis')
  })

  test('never produces leading, trailing or doubled hyphens', () => {
    expect(slugFromName('  --Hello   World--  ')).toBe('hello-world')
  })

  test('keeps the result inside the 63-character limit', () => {
    const long = 'a'.repeat(200)
    expect(slugFromName(long).length).toBe(63)
  })

  test('its output always satisfies the subdomain rules', () => {
    // The regression this guards: a derived value that the schema rejects makes
    // the field fill itself in and immediately turn red.
    const names = [
      'Abugida Academy',
      'Habesha Learning Centre',
      'École Française',
      '123 Numeric Academy',
      'Mixed CASE and spaces',
      'A',
      '!@#$%^&*()',
    ]
    for (const name of names) {
      const slug = slugFromName(name)
      const parsed = SignupWorkspaceSchema.safeParse({
        name: 'A workspace',
        slug,
        useCase: 'run_courses',
      })
      // Only a slug that is simply too short is acceptable here; anything else
      // would be a bug in the derivation.
      if (slug.length >= 3) {
        expect(parsed.success ? true : parsed.error.issues[0]?.message).toBe(true)
      }
    }
  })
})

describe('SignupWorkspaceSchema', () => {
  const valid = { name: 'Abugida Academy', slug: 'abugida', useCase: 'run_courses' }

  test('accepts a well-formed workspace', () => {
    expect(SignupWorkspaceSchema.safeParse(valid).success).toBe(true)
  })

  test('rejects an empty name with a message, never a type error', () => {
    // "Invalid input: expected string, received undefined" is a wiring bug, not
    // a validation message — the field must never be reported that way.
    const result = SignupWorkspaceSchema.safeParse({ ...valid, name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Workspace name must be at least 2 characters')
    }
  })

  test('rejects an uppercase or punctuated subdomain with guidance', () => {
    expect(SignupWorkspaceSchema.safeParse({ ...valid, slug: 'Abugida Academy' }).success).toBe(
      false,
    )
  })

  test('requires a primary use case, and only from the spec set', () => {
    expect(SignupWorkspaceSchema.safeParse({ ...valid, useCase: undefined }).success).toBe(false)
    for (const useCase of PRIMARY_USE_CASES) {
      expect(SignupWorkspaceSchema.safeParse({ ...valid, useCase }).success).toBe(true)
    }
  })

  test('trims and lowercases the subdomain so a pasted value is accepted', () => {
    const result = SignupWorkspaceSchema.safeParse({ ...valid, slug: '  Abugida  ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.slug).toBe('abugida')
  })

  test('a name is trimmed before it is measured', () => {
    expect(SignupWorkspaceSchema.safeParse({ ...valid, name: '  Ab  ' }).success).toBe(true)
  })
})

describe('use case normalisation', () => {
  test('the schema only accepts current values, legacy rows normalise on read', () => {
    expect(
      SignupWorkspaceSchema.safeParse({
        name: 'Abugida Academy',
        slug: 'abugida',
        useCase: 'language_courses',
      }).success,
    ).toBe(false)
    expect(normaliseUseCase('language_courses')).toBe('run_courses')
  })
})
