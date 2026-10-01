import { describe, expect, test } from 'bun:test'
import {
  RESERVED_TENANT_SLUGS,
  TENANT_SLUG_MAX_LENGTH,
  isReservedTenantSlug,
  isValidTenantSlug,
  normalizeTenantSlug,
  slugFromTenantName,
  validateTenantSlug,
} from '../src/slug'

describe('validateTenantSlug', () => {
  test('accepts a canonical slug', () => {
    const result = validateTenantSlug('acme')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.slug).toBe('acme')
  })

  test('accepts digits, hyphens and 63 characters', () => {
    expect(validateTenantSlug('school-2').ok).toBe(true)
    expect(validateTenantSlug('a'.repeat(TENANT_SLUG_MAX_LENGTH)).ok).toBe(true)
  })

  test('rejects an empty slug with a `empty` reason', () => {
    const result = validateTenantSlug('')
    expect(result).toMatchObject({ ok: false, reason: 'empty' })
  })

  test('rejects a slug that is too short or too long', () => {
    expect(validateTenantSlug('ab')).toMatchObject({ ok: false, reason: 'too_short' })
    expect(validateTenantSlug('a'.repeat(TENANT_SLUG_MAX_LENGTH + 1))).toMatchObject({
      ok: false,
      reason: 'too_long',
    })
  })

  test('rejects invalid characters, case, padding and separator abuse', () => {
    const invalid = [
      'Abugida Academy',
      'acme_academy',
      'acme.academy',
      'acme academy',
      'acmé',
      '-acme',
      'acme-',
      'acme--academy',
      ' acme',
    ]
    for (const slug of invalid) {
      expect(validateTenantSlug(slug).ok).toBe(false)
    }
  })

  test('rejects every platform-reserved name, case-insensitively', () => {
    for (const reserved of RESERVED_TENANT_SLUGS) {
      expect(validateTenantSlug(reserved).ok).toBe(false)
      expect(isReservedTenantSlug(reserved)).toBe(true)
    }
    // Case is judged as an invalid format, never as a way past the list.
    expect(isReservedTenantSlug('API')).toBe(true)
    expect(validateTenantSlug('API').ok).toBe(false)
    expect(validateTenantSlug('Dashboard').ok).toBe(false)
  })

  test('the specification reserved names are all reserved', () => {
    for (const slug of ['www', 'dashboard', 'api', 'auth', 'docs', 'admin']) {
      expect(isReservedTenantSlug(slug)).toBe(true)
    }
  })

  test('an ordinary name is not reserved', () => {
    expect(isReservedTenantSlug('acme')).toBe(false)
    expect(isValidTenantSlug('acme')).toBe(true)
  })
})

describe('normalizeTenantSlug', () => {
  test('lowercases and hyphenates a display name', () => {
    expect(normalizeTenantSlug('Abugida Academy Ethiopia')).toBe('abugida-academy-ethiopia')
  })

  test('strips characters a DNS label cannot hold', () => {
    expect(normalizeTenantSlug('Café & Co. (Addis)')).toBe('cafe-co-addis')
  })

  test('never produces leading, trailing or doubled hyphens', () => {
    expect(normalizeTenantSlug('  --Hello   World--  ')).toBe('hello-world')
  })

  test('collapses every run of separators into one', () => {
    expect(normalizeTenantSlug('a___b')).toBe('a-b')
  })

  test('keeps the result inside the DNS label limit without a trailing hyphen', () => {
    const long = `${'a'.repeat(TENANT_SLUG_MAX_LENGTH - 1)} tail`
    const normalized = normalizeTenantSlug(long)
    expect(normalized.length).toBeLessThanOrEqual(TENANT_SLUG_MAX_LENGTH)
    expect(normalized.endsWith('-')).toBe(false)
  })

  test('yields an empty string when nothing usable is left', () => {
    expect(normalizeTenantSlug('!@#$%^&*()')).toBe('')
    expect(normalizeTenantSlug('a')).toBe('a')
  })

  test('slugFromTenantName is the same derivation under a domain name', () => {
    expect(slugFromTenantName('Habesha Learning Centre')).toBe(
      normalizeTenantSlug('Habesha Learning Centre'),
    )
  })
})

describe('normalization feeding validation', () => {
  test('a derived slug is valid whenever it is long enough', () => {
    const names = [
      'Abugida Academy',
      'Habesha Learning Centre',
      'École Française',
      '123 Numeric Academy',
      'Mixed CASE and spaces',
    ]
    for (const name of names) {
      expect(validateTenantSlug(normalizeTenantSlug(name)).ok).toBe(true)
    }
  })

  test('normalization does not rescue a reserved name', () => {
    expect(validateTenantSlug(normalizeTenantSlug('Admin')).ok).toBe(false)
  })

  test('validation never rewrites: uppercase and canonical are different identities', () => {
    // The request path must not be able to re-point a tenant by changing case.
    expect(validateTenantSlug('ACME').ok).toBe(false)
    expect(validateTenantSlug('acme').ok).toBe(true)
  })
})
