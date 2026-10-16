/**
 * S-8.5 Testimonial 3-way edit classification + re-confirmation + opt-out
 * (spec 10 Rev-3). Replaces the binary heavyEdit boolean with typo/light/heavy.
 */

export type EditClassification = 'typo' | 'light' | 'heavy'

export const EDIT_CLASSIFICATION_LABELS: Record<EditClassification, string> = {
  typo: 'Typo fix',
  light: 'Light edit',
  heavy: 'Heavy edit',
}

export const EDIT_CLASSIFICATION_CONSEQUENCES: Record<EditClassification, string> = {
  typo: 'No contact needed',
  light: 'Author notified',
  heavy: 'Re-confirmation required',
}

/**
 * Classify an edit by comparing original vs edited text.
 *
 * - typo: no word added/removed/reordered — only character-level fixes within
 *   existing words (e.g., "teh" → "the").
 * - light: minor wording changes — a few words changed but the structure and
 *   meaning are preserved.
 * - heavy: substantial change — multiple sentences reworded, meaning shifted,
 *   or length changed significantly.
 */
export function classifyEdit(original: string, edited: string): EditClassification {
  if (original === edited) return 'typo'

  const origWords = original.toLowerCase().split(/\s+/).filter(Boolean)
  const editWords = edited.toLowerCase().split(/\s+/).filter(Boolean)

  // Same word count + same word order → likely typo fixes only
  if (origWords.length === editWords.length) {
    let allSameWords = true
    let charChangesOnly = true
    for (let i = 0; i < origWords.length; i++) {
      if (origWords[i] !== editWords[i]) {
        allSameWords = false
        // Check if it's a character-level fix (same length ±1, Levenshtein ≤ 2)
        if (!isCharLevelFix(origWords[i], editWords[i])) {
          charChangesOnly = false
        }
      }
    }
    if (allSameWords) return 'typo'
    if (charChangesOnly) return 'typo'
  }

  // Compute word overlap ratio
  const origSet = new Set(origWords)
  const editSet = new Set(editWords)
  const intersection = [...origSet].filter((w) => editSet.has(w))
  const union = new Set([...origSet, ...editSet])
  const overlapRatio = intersection.length / union.size

  // Heavy: low overlap OR significantly different length
  const lengthDiff = Math.abs(origWords.length - editWords.length)
  const lengthRatio =
    Math.min(origWords.length, editWords.length) / Math.max(origWords.length, editWords.length)

  if (overlapRatio < 0.4 || lengthRatio < 0.5 || lengthDiff > 5) {
    return 'heavy'
  }

  return 'light'
}

function isCharLevelFix(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  // Simple Levenshtein ≤ 2
  let diff = 0
  const maxLen = Math.max(a.length, b.length)
  for (let i = 0; i < maxLen; i++) {
    if (a[i] !== b[i]) diff++
    if (diff > 2) return false
  }
  return true
}

// ── Re-confirmation ────────────────────────────────────────────────────────

export type ReconfirmationStatus = 'pending' | 'accepted' | 'declined' | 'timed_out'

export const RECONFIRMATION_TIMEOUT_DAYS = 14
export const RECONFIRMATION_TIMEOUT_MS = RECONFIRMATION_TIMEOUT_DAYS * 24 * 60 * 60 * 1000

export function shouldTriggerReconfirmation(classification: EditClassification): boolean {
  return classification === 'heavy'
}

export function reconfirmationStatusLabel(status: ReconfirmationStatus | null): string {
  if (!status) return ''
  switch (status) {
    case 'pending':
      return 'Pending re-confirmation'
    case 'accepted':
      return 'Re-confirmed'
    case 'declined':
      return 'Declined re-confirmation'
    case 'timed_out':
      return `Timed out (${RECONFIRMATION_TIMEOUT_DAYS} days)`
  }
}

export function reconfirmationTimedOut(sentAt: number, now: number): boolean {
  return now - sentAt >= RECONFIRMATION_TIMEOUT_MS
}

export function shouldUnlistDuringReconfirmation(status: ReconfirmationStatus | null): boolean {
  return status === 'pending'
}

export function reconfirmationMessage(testimonialTitle: string): string {
  return `We edited your testimonial for "${testimonialTitle}". Please review and confirm the change is okay.`
}

// ── Opt-out ────────────────────────────────────────────────────────────────

export type OptOutBy = 'student' | 'staff' | 'system'

export function optOutLabel(optedBy: OptOutBy): string {
  switch (optedBy) {
    case 'student':
      return 'Opted out by student'
    case 'staff':
      return 'Opted out by staff'
    case 'system':
      return 'Opted out automatically (inactivity)'
  }
}

export function shouldUnlistOptedOut(optedOutAt: number | null): boolean {
  return optedOutAt !== null
}
