/**
 * Spec 13 § Safety interlocks — pure validators that block a workspace-config
 * save when it would lock the workspace out.
 *
 * Each interlock is a pure function: it takes the proposed change + the
 * workspace state and returns `{ ok: true }` or `{ ok: false, reason }`. The
 * reason names the fix per Part 11 § Gate-with-a-Way-Out — never a silent
 * failure, never a generic "validation error".
 *
 * The interlocks are:
 *
 *  1. **requireMfaForAll** — blocks when the workspace has exactly one owner.
 *     A lost authenticator would lock the workspace out.
 *  2. **lockoutThresholdDecrease** — blocks when the new threshold is below
 *     the failed-attempts count already recorded for any member.
 *  3. **maxMembersDecrease** — blocks when the new limit is below the current
 *     member count.
 *  4. **selfServiceWorkspacesDecrease** — blocks when any user is in more
 *     workspaces than the new limit allows.
 *  5. **sessionTimeoutDecrease** — blocks when an active owner session would
 *     be expired mid-operation.
 *
 * The server impl calls these before writing the policies jsonb. The UI also
 * calls them on field-change so the author sees the block before they hit
 * Save (Part 11 § Forms: validate at input, not at submit).
 */
import type { WorkspacePolicies } from '@abugida/database/auth'

/** A successful interlock check. */
export interface InterlockOk {
  ok: true
}

/** A blocked interlock. The `reason` is shown to the author verbatim. */
export interface InterlockBlocked {
  ok: false
  /** The policy key that triggered the block, for field-level UI targeting. */
  field: keyof WorkspacePolicies | 'accountLockoutMaxAttempts'
  /**
   * Human-readable reason that names the fix per Part 11 § Gate-with-a-Way-Out.
   * The UI renders this inline below the field.
   */
  reason: string
}

export type InterlockResult = InterlockOk | InterlockBlocked

/**
 * Spec 13 § Safety interlocks — input shape for the pure validators.
 *
 * The server impl reads the workspace state (member count, owner count,
 * failed-attempt counts, active sessions, cross-workspace membership counts)
 * and passes it in. The pure function decides whether the proposed change is
 * safe.
 */
export interface InterlockContext {
  /** The proposed new policies (a partial over the existing policies). */
  changes: Partial<WorkspacePolicies>
  /** The current policies, before the change. */
  current: WorkspacePolicies | null
  /** The number of members in the workspace. */
  memberCount: number
  /** The number of owners in the workspace (member.role = 'owner'). */
  ownerCount: number
  /**
   * The highest failed-attempt count recorded for any member, for the
   * lockout-threshold interlock. Zero when no one has failed recently.
   */
  maxFailedAttempts: number
  /**
   * Whether an owner session is currently active, for the session-timeout
   * interlock. The spec calls out "mid-operation" — we treat any active owner
   * session as a potential mid-operation.
   */
  hasActiveOwnerSession: boolean
  /**
   * The number of users who are in more workspaces than a proposed
   * `organizationLimit` decrease would allow. Zero when the limit is not
   * being decreased or no one is over the new limit.
   */
  usersOverNewOrganizationLimit: number
}

/**
 * 1. Require MFA for all members.
 *
 * Blocked when the workspace has exactly one owner. A lost authenticator
 * would lock the workspace out — there is no second admin to recover.
 *
 * Spec copy: "Add a second admin first — otherwise a lost authenticator
 * locks the workspace."
 */
export function checkRequireMfaForAllInterlock(ctx: InterlockContext): InterlockResult {
  const proposed = ctx.changes.requireMfaFor
  if (proposed !== 'everyone') return { ok: true }
  if (ctx.ownerCount <= 1) {
    return {
      ok: false,
      field: 'requireMfaFor',
      reason:
        'Add a second admin first — otherwise a lost authenticator locks the workspace.',
    }
  }
  return { ok: true }
}

/**
 * 2. Lockout threshold decrease.
 *
 * Blocked when the new threshold is below the failed-attempts count already
 * recorded for a member. Decreasing the threshold below an existing count
 * would lock that member out immediately.
 *
 * Spec copy: "3 attempts is below the 5 already recorded for Alemayehu K."
 *
 * The interlock takes the max failed-attempt count rather than a per-member
 * list; the server impl can refine the message with the member's name.
 */
export function checkLockoutThresholdDecreaseInterlock(
  ctx: InterlockContext,
  envAccountLockoutMaxAttempts: number,
  proposedEnvAccountLockoutMaxAttempts?: number,
): InterlockResult {
  // The lockout threshold is env-only on S-13.1, but the interlock still
  // applies if a future revision makes it workspace-configurable. For now,
  // the interlock only fires when `proposedEnvAccountLockoutMaxAttempts` is
  // set (i.e., the change is being proposed through a path that can touch
  // env — which S-13.1 cannot, but the underlying server fn could).
  if (proposedEnvAccountLockoutMaxAttempts === undefined) return { ok: true }
  if (proposedEnvAccountLockoutMaxAttempts < envAccountLockoutMaxAttempts) {
    if (proposedEnvAccountLockoutMaxAttempts <= ctx.maxFailedAttempts) {
      return {
        ok: false,
        field: 'accountLockoutMaxAttempts',
        reason: `${proposedEnvAccountLockoutMaxAttempts} attempts is below the ${ctx.maxFailedAttempts} already recorded for a member.`,
      }
    }
  }
  return { ok: true }
}

/**
 * 3. Max members decrease.
 *
 * Blocked when the new limit is below the current member count. The author
 * must remove members first.
 *
 * Spec copy: "You have 12 members. Lower the limit to remove someone first."
 */
export function checkMaxMembersDecreaseInterlock(ctx: InterlockContext): InterlockResult {
  const proposed = ctx.changes.membershipLimit
  if (proposed === null || proposed === undefined) return { ok: true }
  const current = ctx.current?.membershipLimit ?? null
  // Only block on a decrease. An increase or a no-op is safe.
  if (current !== null && proposed >= current) return { ok: true }
  if (proposed < ctx.memberCount) {
    return {
      ok: false,
      field: 'membershipLimit',
      reason: `You have ${ctx.memberCount} member${ctx.memberCount === 1 ? '' : 's'}. Lower the limit to remove someone first.`,
    }
  }
  return { ok: true }
}

/**
 * 4. Allow self-service workspaces decrease.
 *
 * Blocked when any user is in more workspaces than the new limit allows. The
 * `organizationLimit` field is the cap; lowering it below existing usage
 * would put those users out of policy without removing them.
 *
 * Spec copy: "3 people are in 4+ workspaces. Raise the limit or remove them
 * first."
 */
export function checkSelfServiceWorkspacesDecreaseInterlock(ctx: InterlockContext): InterlockResult {
  const proposed = ctx.changes.organizationLimit
  if (proposed === null || proposed === undefined) return { ok: true }
  const current = ctx.current?.organizationLimit ?? null
  if (current !== null && proposed >= current) return { ok: true }
  if (ctx.usersOverNewOrganizationLimit > 0) {
    return {
      ok: false,
      field: 'organizationLimit',
      reason: `${ctx.usersOverNewOrganizationLimit} ${ctx.usersOverNewOrganizationLimit === 1 ? 'person is' : 'people are'} in more workspaces than the new limit allows. Raise the limit or remove them first.`,
    }
  }
  return { ok: true }
}

/**
 * 5. Session timeout decrease.
 *
 * Blocked when an active owner session would be expired mid-operation. The
 * author cannot end their own session by lowering the timeout.
 *
 * Spec copy: "This would end your own session. Ask another admin to change
 * it."
 */
export function checkSessionTimeoutDecreaseInterlock(ctx: InterlockContext): InterlockResult {
  const proposed = ctx.changes.sessionTimeoutMinutes
  if (proposed === null || proposed === undefined) return { ok: true }
  const current = ctx.current?.sessionTimeoutMinutes ?? null
  if (current !== null && proposed >= current) return { ok: true }
  if (ctx.hasActiveOwnerSession) {
    return {
      ok: false,
      field: 'sessionTimeoutMinutes',
      reason: 'This would end your own session. Ask another admin to change it.',
    }
  }
  return { ok: true }
}

/**
 * Run every interlock against the proposed change. Returns the first block,
 * or `{ ok: true }` if all pass. The order is the spec's table order.
 *
 * The server impl calls this before writing the policies jsonb. The UI can
 * also call it on field-change for early feedback.
 */
export function runAllInterlocks(ctx: InterlockContext): InterlockResult {
  const interlocks: InterlockResult[] = [
    checkRequireMfaForAllInterlock(ctx),
    checkMaxMembersDecreaseInterlock(ctx),
    checkSelfServiceWorkspacesDecreaseInterlock(ctx),
    checkSessionTimeoutDecreaseInterlock(ctx),
    // The lockout-threshold interlock is env-only today; pass through with
    // no env proposal so it always returns ok.
    checkLockoutThresholdDecreaseInterlock(ctx, 0),
  ]
  for (const result of interlocks) {
    if (!result.ok) return result
  }
  return { ok: true }
}
