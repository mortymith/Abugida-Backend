/**
 * Waitlist lifecycle logic (spec 04 § S-2.18 → Students tab, spec 06 §
 * S-4.6 → Waitlist; backed by the `waitlists` table from migration 0029).
 *
 * A waitlist row moves through the lifecycle:
 *
 * ```
 * waiting → offered → enrolled    (happy path)
 * waiting → expired                (offer lapsed)
 * waiting → cancelled              (student withdrew)
 * offered → expired                (offer lapsed)
 * offered → enrolled               (student accepted)
 * offered → cancelled              (student declined)
 * ```
 *
 * The background worker:
 * - Transitions `offered → expired` when `expiresAt` passes.
 * - Promotes `waiting → offered` when a seat opens (enrollment cancelled
 *   or capacity increased).
 *
 * This module is framework-free: it owns the transition validation and
 * the expiry computation.
 */

export type WaitlistStatus = 'waiting' | 'offered' | 'enrolled' | 'expired' | 'cancelled'

export const WAITLIST_STATUS_LABELS: Record<WaitlistStatus, string> = {
  waiting: 'Waiting',
  offered: 'Offered — awaiting response',
  enrolled: 'Enrolled',
  expired: 'Offer expired',
  cancelled: 'Cancelled',
}

export interface WaitlistEntry {
  readonly id: string
  readonly status: WaitlistStatus
  readonly requestedAt: number
  readonly offeredAt: number | null
  readonly expiresAt: number | null
  readonly enrolledAt: number | null
}

/**
 * Valid transitions in the waitlist lifecycle. A transition not in this
 * map is invalid.
 */
const VALID_TRANSITIONS: ReadonlyMap<WaitlistStatus, ReadonlySet<WaitlistStatus>> = new Map([
  ['waiting', new Set(['offered', 'cancelled', 'expired'])],
  ['offered', new Set(['enrolled', 'expired', 'cancelled'])],
  ['enrolled', new Set()], // terminal
  ['expired', new Set()], // terminal
  ['cancelled', new Set()], // terminal
])

export function isValidTransition(from: WaitlistStatus, to: WaitlistStatus): boolean {
  return VALID_TRANSITIONS.get(from)?.has(to) ?? false
}

/**
 * Validate a transition, returning an error message when invalid.
 * Used by the server function before persisting a status change.
 */
export function validateTransition(
  from: WaitlistStatus,
  to: WaitlistStatus,
): { valid: boolean; reason: string | null } {
  if (from === to) return { valid: false, reason: 'No change' }
  if (isValidTransition(from, to)) return { valid: true, reason: null }
  return {
    valid: false,
    reason: `Cannot transition from ${WAITLIST_STATUS_LABELS[from]} to ${WAITLIST_STATUS_LABELS[to]}`,
  }
}

/**
 * Compute the offer expiry for a `waiting → offered` transition. The
 * spec does not pin a specific offer window; 72 hours is the conventional
 * default (gives the student time to respond across timezones).
 */
export const OFFER_WINDOW_HOURS = 72
export const OFFER_WINDOW_MS = OFFER_WINDOW_HOURS * 60 * 60 * 1000

export function computeOfferExpiry(offeredAt: number): number {
  return offeredAt + OFFER_WINDOW_MS
}

/**
 * Whether an offered entry has expired (the offer window passed without
 * the student accepting). Used by the background worker to find rows to
 * transition `offered → expired`.
 */
export function isOfferExpired(entry: WaitlistEntry, now: number): boolean {
  if (entry.status !== 'offered') return false
  if (entry.expiresAt === null) return false
  return now >= entry.expiresAt
}

/**
 * Find entries eligible for expiry. The worker calls this on a schedule
 * (e.g. every 15 minutes) to transition lapsed offers.
 */
export function entriesEligibleForExpiry(
  entries: readonly WaitlistEntry[],
  now: number,
): WaitlistEntry[] {
  return entries.filter((e) => isOfferExpired(e, now))
}

/**
 * Whether a seat is available to offer to the next waiting entry.
 * `currentEnrollment` is the current enrolled count; `capacity` is the
 * course's max enrollment. A seat opens when current < capacity.
 */
export function isSeatAvailable(currentEnrollment: number, capacity: number): boolean {
  return currentEnrollment < capacity
}

/**
 * Pick the next entry to offer when a seat opens. The spec does not pin a
 * specific ordering; FIFO (oldest `requestedAt` first) is the
 * conventional default.
 */
export function pickNextToOffer(entries: readonly WaitlistEntry[]): WaitlistEntry | null {
  const waiting = entries.filter((e) => e.status === 'waiting')
  if (waiting.length === 0) return null
  return waiting.reduce((oldest, current) =>
    current.requestedAt < oldest.requestedAt ? current : oldest,
  )
}

/**
 * The position of `entry` in the waiting queue (1-indexed). Returns `null`
 * when the entry is not waiting.
 */
export function waitlistPosition(
  entries: readonly WaitlistEntry[],
  entryId: string,
): number | null {
  const waiting = entries
    .filter((e) => e.status === 'waiting')
    .sort((a, b) => a.requestedAt - b.requestedAt)
  const idx = waiting.findIndex((e) => e.id === entryId)
  return idx === -1 ? null : idx + 1
}
