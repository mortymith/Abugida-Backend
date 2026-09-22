import { describe, expect, test } from 'bun:test'
import {
  HEAVY_EDIT_RATIO,
  isAuthorActive,
  isHeavyEdit,
  isQuoteLengthValid,
  QUOTE_MAX_LENGTH,
  QUOTE_MIN_LENGTH,
  validateModeration,
} from '#/features/marketing/marketing.testimonial-rules'

/**
 * S-8.5 moderation rules (spec 10): consent-first approval, quote length
 * bounds, heavy-edit detection with student re-confirmation, polite rejection
 * with archival, and the anonymization privacy rule.
 */
describe('testimonial rules', () => {
  test('quote bounds match the spec (20-400 characters)', () => {
    expect(QUOTE_MIN_LENGTH).toBe(20)
    expect(QUOTE_MAX_LENGTH).toBe(400)
    expect(isQuoteLengthValid('The 12-week plan took me from 79 to 101.')).toBe(true)
    expect(isQuoteLengthValid('Too short')).toBe(false)
    expect(isQuoteLengthValid(`${'q'.repeat(401)}`)).toBe(false)
    expect(isQuoteLengthValid(`${'q'.repeat(400)}`)).toBe(true)
  })

  test('typo-level edits are not heavy', () => {
    expect(
      isHeavyEdit(
        'The 12-week plan took me from 79 to 101 points.',
        'The 12-week plan took me from 79 to 101 point.',
      ),
    ).toBe(false)
  })

  test('rewriting most words flags a heavy edit', () => {
    const original =
      'The structured plan, weekly feedback, and speaking drills changed everything for me'
    const edited = 'Honestly I cannot recommend this course enough, the teachers are amazing'
    expect(isHeavyEdit(original, edited)).toBe(true)
    expect(HEAVY_EDIT_RATIO).toBeGreaterThan(0)
    expect(HEAVY_EDIT_RATIO).toBeLessThan(1)
  })

  test('approval requires verified consent', () => {
    const result = validateModeration({
      decision: 'approve',
      consentConfirmed: false,
      currentStatus: 'pending',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Consent')

    expect(
      validateModeration({ decision: 'approve', consentConfirmed: true, currentStatus: 'pending' })
        .ok,
    ).toBe(true)
  })

  test('only pending testimonials can be approved', () => {
    const result = validateModeration({
      decision: 'approve',
      consentConfirmed: true,
      currentStatus: 'published',
    })
    expect(result.ok).toBe(false)
  })

  test('edits require a valid quote length', () => {
    const result = validateModeration({
      decision: 'edit',
      consentConfirmed: true,
      currentStatus: 'pending',
      quote: 'short',
    })
    expect(result.ok).toBe(false)
    expect(
      validateModeration({
        decision: 'edit',
        consentConfirmed: true,
        currentStatus: 'pending',
        quote: 'A perfectly reasonable edited quote.',
      }).ok,
    ).toBe(true)
  })

  test('rejection requires a polite reason', () => {
    const missing = validateModeration({
      decision: 'reject',
      consentConfirmed: false,
      currentStatus: 'pending',
    })
    expect(missing.ok).toBe(false)

    const ok = validateModeration({
      decision: 'reject',
      consentConfirmed: false,
      currentStatus: 'pending',
      rejectionReason: 'Not a fit for the landing page right now',
    })
    expect(ok.ok).toBe(true)
  })

  test('published testimonials cannot be rejected outright', () => {
    const result = validateModeration({
      decision: 'reject',
      consentConfirmed: true,
      currentStatus: 'published',
      rejectionReason: 'changed our mind',
    })
    expect(result.ok).toBe(false)
  })

  test('anonymized (deleted or deactivated) authors stay unlisted', () => {
    expect(isAuthorActive({ deletedAt: null, accountStatus: 'active' })).toBe(true)
    expect(isAuthorActive({ deletedAt: new Date(), accountStatus: 'active' })).toBe(false)
    expect(isAuthorActive({ deletedAt: null, accountStatus: 'deleted' })).toBe(false)
  })
})
