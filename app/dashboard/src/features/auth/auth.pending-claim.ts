/**
 * Carrying a claimed invite across the sign-in redirect.
 *
 * A claim happens on the login screen, *before* there is a session — that is
 * where the code is captured (`11` § Notification Delivery). The server answers
 * that pre-signin claim with a signed ticket, and the ticket has to outlive a
 * full provider redirect to be useful.
 *
 * `sessionStorage`, not `localStorage`:
 *
 *  - it dies with the tab, so a ticket cannot be sitting on a shared machine
 *    waiting to be redeemed by whoever opens the app next;
 *  - it survives the OAuth round-trip, which is the one jump that matters.
 *
 * The ticket grants nothing on its own — it names an invite, and only a live
 * session supplies the user — so the blast radius of a stale entry is nil.
 * It expires on its own after {@link CLAIM_TICKET_TTL_SECONDS} regardless.
 */

import { completeInviteClaim } from './server/auth.signin'

const STORAGE_KEY = 'abugida.pending-invite-claim'

/** `sessionStorage` is absent during SSR and can throw in a locked-down browser. */
function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function stashPendingClaimTicket(ticket: string): void {
  try {
    storage()?.setItem(STORAGE_KEY, ticket)
  } catch {
    // A ticket we cannot stash is a claim that completes on the next visit.
    // Never fail the claim over it.
  }
}

export function readPendingClaimTicket(): string | null {
  try {
    return storage()?.getItem(STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

export function clearPendingClaimTicket(): void {
  try {
    storage()?.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do; the entry expires on its own.
  }
}

export type PendingClaimOutcome = 'redeemed' | 'none' | 'unusable' | 'unreachable'

/**
 * Redeem a stashed ticket, if there is one.
 *
 * Only a *terminal* answer clears the stash. A network failure keeps it, because
 * the user has just signed in and the seat is theirs — losing the claim to a
 * flaky connection is the one outcome worth retrying on the next navigation.
 */
export async function redeemPendingClaim(): Promise<PendingClaimOutcome> {
  const ticket = readPendingClaimTicket()
  if (!ticket) return 'none'

  try {
    const result = await completeInviteClaim({ data: { ticket } })

    if (result.status === 'claimed') {
      clearPendingClaimTicket()
      return 'redeemed'
    }

    // Expired, consumed, or forged: retrying will never help.
    clearPendingClaimTicket()
    return 'unusable'
  } catch {
    return 'unreachable'
  }
}
