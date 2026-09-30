/**
 * Server-only claimable-invite issuance and claim (spec S-0.1 action 3,
 * `11` § Notification Delivery, `13` § GAP-2).
 *
 * The pure rules — what a reference may look like, how a secret is hashed, how
 * the pre-signin receipt is signed — live in `auth.invite-claim.ts`. This file
 * is the half that touches the database, and it exists separately from
 * `auth.signin.impl.server` because claiming an invite is a different concern
 * from recording a sign-in outcome.
 *
 * **Why the claim is split in two.** The claim screen runs *before* sign-in —
 * that is where the code is captured, per `11` § Notification Delivery. There is
 * no user to attach at that moment. So:
 *
 *  1. `claimInvite` (pre-signin) proves only that the reference is real, and
 *     returns a signed ticket. It does **not** consume the invite: a user who
 *     mistypes their password on the next screen has not forfeited their seat,
 *     and burning it here would make a false start unrecoverable.
 *  2. `completeInviteClaim` (post-signin) exchanges that ticket for membership.
 *     This is the single write that consumes the invite.
 *
 * A caller who is already signed in skips step 1 and gets both in one call.
 *
 * Never import from client code.
 */
import { and, eq, gt } from '@abugida/database'
import { inviteLink, member } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import { env } from '#/config/app.config'
import { currentUserId, requireUserId } from './auth.request.server'
import { mapBetterAuthRoleToPlatformRole } from '../auth.roles'
import { AUTH_EVENTS, countAuthEvent } from './auth.events.server'
import {
  generateClaimCode,
  generateClaimToken,
  hashClaimSecret,
  hashForReference,
  inviteLinkExpiry,
  isExpired,
  normalizeClaimReference,
  signClaimTicket,
  verifyClaimTicket,
} from '../auth.invite-claim'

/**
 * Every unusable reference resolves to a member of this union. The UI folds
 * `not_found`, `expired` and `consumed` into one message, so the extra precision
 * here costs the user nothing and keeps the server honest about why it refused.
 */
export type InviteClaimResult =
  | { status: 'claimed'; organizationId: string }
  | { status: 'pending_signin'; ticket: string }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'consumed' }

type InviteRow = typeof inviteLink.$inferSelect

/**
 * Look up a pending, unexpired invite by its hashed reference.
 *
 * Returns the row plus the reason it is unusable, so the caller can distinguish
 * a typo from a spent link without a second query.
 */
async function findClaimableInvite(reference: {
  kind: 'token' | 'code'
  value: string
}): Promise<{ row: InviteRow } | { status: 'not_found' | 'expired' | 'consumed' }> {
  const hash = await hashForReference(reference)

  const rows = await db
    .select()
    .from(inviteLink)
    .where(
      reference.kind === 'code' ? eq(inviteLink.codeHash, hash) : eq(inviteLink.tokenHash, hash),
    )
    .limit(1)

  const row = rows.at(0)
  if (!row) return { status: 'not_found' }
  if (row.status !== 'pending') return { status: 'consumed' }
  if (isExpired(row.expiresAt)) return { status: 'expired' }

  return { row }
}

/**
 * Consume an invite and grant membership.
 *
 * The conditional `UPDATE ... RETURNING` is the whole concurrency story. A
 * read-then-write would let two people racing on the same link both observe
 * `pending` and both become members; here the database decides, and the loser
 * gets zero rows back.
 *
 * Both writes are in one transaction because the pair is a single promise to
 * the user: a consumed invite with no membership is worse than a failed claim,
 * because the link is gone and cannot be retried. Inside the transaction the
 * invite row is locked until the member row exists, so a rollback leaves the
 * invite claimable and the user can simply press the button again.
 */
async function consumeInviteLink(inviteLinkId: string, userId: string): Promise<InviteClaimResult> {
  const claimed = await db.transaction(async (tx) => {
    const now = new Date()

    const updated = await tx
      .update(inviteLink)
      .set({ status: 'claimed', claimedAt: now, claimedByUserId: userId })
      .where(
        and(
          eq(inviteLink.id, inviteLinkId),
          eq(inviteLink.status, 'pending'),
          gt(inviteLink.expiresAt, now),
        ),
      )
      .returning({ organizationId: inviteLink.organizationId, role: inviteLink.role })

    const link = updated.at(0)
    // Returning `null` commits an empty transaction — there is nothing to undo,
    // and the invite is untouched, so the loser of a race has not damaged it.
    if (!link) return null

    await tx
      .insert(member)
      .values({
        // `member.id` has no column default — Better Auth supplies the id on its
        // own writes, so a direct insert has to.
        id: crypto.randomUUID(),
        organizationId: link.organizationId,
        userId,
        role: mapBetterAuthRoleToPlatformRole(link.role),
      })
      // A user who is already a member keeps the role they had rather than
      // being demoted by a second claim, so a duplicate is a no-op.
      .onConflictDoNothing()

    return link
  })

  if (!claimed) {
    // Lost the race, expired between the lookup and now, or already consumed.
    // All three are the same answer to the person holding the link.
    return { status: 'consumed' }
  }

  countAuthEvent(AUTH_EVENTS.inviteClaimed)
  return { status: 'claimed', organizationId: claimed.organizationId }
}

/**
 * Claim an invite from `/invite/:token` or an 8-character code.
 *
 * Called from the login screen, so it must work signed out. Signed in, it
 * claims outright; signed out, it returns a ticket for
 * {@link completeInviteClaimImpl} to redeem after the provider redirect.
 */
export async function claimInviteImpl(input: {
  token?: string | null
  code?: string | null
  providerAccountId?: string | null
}): Promise<InviteClaimResult> {
  // `providerAccountId` is accepted for wire compatibility with the S-0.1
  // callback; membership is keyed on the session user, never on a client-supplied
  // provider id, so it is deliberately unused here.
  void input.providerAccountId

  const reference = normalizeClaimReference(input)
  if (!reference) return { status: 'not_found' }

  const found = await findClaimableInvite(reference)
  if ('status' in found) return { status: found.status }

  const userId = await currentUserId()
  if (userId) return consumeInviteLink(found.row.id, userId)

  return {
    status: 'pending_signin',
    ticket: await signClaimTicket(found.row.id, env.BETTER_AUTH_SECRET),
  }
}

/**
 * Redeem a pre-signin claim ticket once the user has a session.
 *
 * The ticket names the invite and proves the platform issued it; the live
 * session supplies the user. Neither alone is enough, which is the point — a
 * stolen link gets a ticket that names an invite but not a person.
 */
export async function completeInviteClaimImpl(input: {
  ticket?: string | null
}): Promise<InviteClaimResult> {
  const userId = await requireUserId()
  const ticket = input.ticket?.trim()
  if (!ticket) return { status: 'not_found' }

  const inviteLinkId = await verifyClaimTicket(ticket, env.BETTER_AUTH_SECRET)
  if (!inviteLinkId) return { status: 'not_found' }

  return consumeInviteLink(inviteLinkId, userId)
}

export type IssueInviteLinkResult =
  | { status: 'issued'; token: string; code: string; expiresAt: string; organizationId: string }
  | { status: 'failed'; reason: 'not_a_member' | 'server_error' }

/**
 * Issue a claimable invite for a workspace.
 *
 * Only a member of that workspace may issue one — the role check is here rather
 * than in the caller so that no screen can accidentally skip it.
 *
 * This is the storage GAP-2 was blocking. Surfacing it in the team screen
 * (S-6.2) is a separate UI change; the capability is complete and callable
 * without it.
 */
export async function issueInviteLinkImpl(input: {
  organizationId: string
  role?: string | null
  email?: string | null
  handle?: string | null
}): Promise<IssueInviteLinkResult> {
  const userId = await requireUserId()

  const memberships = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, input.organizationId), eq(member.userId, userId)))
    .limit(1)

  if (!memberships.at(0)) return { status: 'failed', reason: 'not_a_member' }

  try {
    const token = generateClaimToken()
    const code = generateClaimCode()
    const expiresAt = inviteLinkExpiry()

    await db.insert(inviteLink).values({
      organizationId: input.organizationId,
      role: input.role ?? 'member',
      email: input.email?.trim() || null,
      handle: input.handle?.trim() || null,
      tokenHash: await hashClaimSecret(token),
      codeHash: await hashClaimSecret(code),
      expiresAt,
      inviterId: userId,
    })

    // The raw token and code exist only in this response. What is stored is a
    // digest, so a workspace that loses the message has to reissue rather than
    // recover — which is the intended trade for a credential.
    return {
      status: 'issued',
      token,
      code,
      expiresAt: expiresAt.toISOString(),
      organizationId: input.organizationId,
    }
  } catch {
    return { status: 'failed', reason: 'server_error' }
  }
}
