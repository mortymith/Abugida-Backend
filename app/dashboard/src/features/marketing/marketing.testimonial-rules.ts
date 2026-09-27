/**
 * Testimonial moderation rules (spec 10 S-8.5) — pure module. Consent to
 * public display is mandatory before approval; light edits are allowed with
 * an editor-initials note while heavier edits flag student re-confirmation;
 * rejected submissions are archived (retained for reference).
 */

export const QUOTE_MIN_LENGTH = 20
export const QUOTE_MAX_LENGTH = 400

/** Word-level change ratio above which an edit is considered heavy. */
export const HEAVY_EDIT_RATIO = 0.3

export function isQuoteLengthValid(quote: string): boolean {
  const trimmed = quote.trim()
  return trimmed.length >= QUOTE_MIN_LENGTH && trimmed.length <= QUOTE_MAX_LENGTH
}

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Spec: "edits beyond typo fixes should be re-confirmed with the student
 * (system flags heavy edits)". A heavy edit changes more than 30% of words
 * (relative to the longer quote) — the UI then prompts the moderator.
 */
export function isHeavyEdit(original: string, edited: string): boolean {
  const a = normalize(original)
  const b = normalize(edited)
  if (a.length === 0 && b.length === 0) return false
  const longer = Math.max(a.length, b.length)
  const kept = new Set(a)
  const overlap = b.filter((word) => kept.has(word)).length
  return 1 - overlap / longer > HEAVY_EDIT_RATIO
}

export type TestimonialDecision = 'approve' | 'edit' | 'reject'

export interface ModerationValidation {
  ok: boolean
  error?: string
}

/**
 * Server-side guard for moderation decisions. Approving without verified
 * consent is impossible (spec: "a submission without consent cannot be
 * published").
 */
export function validateModeration(input: {
  decision: TestimonialDecision
  consentConfirmed: boolean
  currentStatus: 'pending' | 'published' | 'rejected' | 'archived'
  quote?: string
  rejectionReason?: string
}): ModerationValidation {
  if (input.decision === 'approve') {
    if (input.currentStatus !== 'pending') {
      return { ok: false, error: 'Only pending testimonials can be approved' }
    }
    if (!input.consentConfirmed) {
      return { ok: false, error: 'Consent to display publicly must be confirmed first' }
    }
    return { ok: true }
  }
  if (input.decision === 'edit') {
    if (input.currentStatus !== 'pending' && input.currentStatus !== 'published') {
      return { ok: false, error: 'Only pending or published testimonials can be edited' }
    }
    if (!input.quote || !isQuoteLengthValid(input.quote)) {
      return {
        ok: false,
        error: `Quote must be between ${QUOTE_MIN_LENGTH} and ${QUOTE_MAX_LENGTH} characters`,
      }
    }
    return { ok: true }
  }
  if (input.currentStatus === 'published') {
    return { ok: false, error: 'Published testimonials must be unfeatured and unpublished first' }
  }
  if (!input.rejectionReason?.trim()) {
    return { ok: false, error: 'A short, polite reason is required when rejecting' }
  }
  return { ok: true }
}

/**
 * Spec: "anonymized students' testimonials are automatically unlisted."
 * Anonymization erases identity, so a testimonial whose author no longer
 * resolves to an active account is excluded from published reads.
 */
export function isAuthorActive(author: { deletedAt: Date | null; accountStatus: string }): boolean {
  return author.deletedAt == null && author.accountStatus === 'active'
}
