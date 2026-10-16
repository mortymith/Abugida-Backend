/**
 * Review & Approval Queue guards (spec 04 § S-2.14 → Review & Approval
 * Queue, § S-2.22 → Publish Readiness & Course Review).
 *
 * Three guards live here:
 *
 * 1. **Stale-submission guard.** When a reviewer opens a submission whose
 *    `submittedVersion` is older than the entity's `currentVersion`, the
 *    Approve button is disabled with "Re-review the current version". The
 *    reviewer must re-pull the latest version before approving — approving
 *    a stale version would publish content the reviewer never saw.
 *
 * 2. **Self-approval guard.** A user can never approve a submission they
 *    authored. The single-reviewer-authored case renders "Yours —
 *    awaiting another reviewer" + a Reassign action.
 *
 * 3. **Bulk-approve (never bulk-reject).** The queue supports bulk-approve
 *    but never bulk-reject — rejection requires a per-item comment, and
 *    batching comments would make them generic. Bulk-approve reports
 *    per-outcome results (spec 11 § Partial Failure).
 *
 * This module is framework-free: it owns the guard logic. The React
 * component consults these helpers to decide button enablement.
 */

export type ReviewDecision = 'approve' | 'request_changes' | 'reject'

export const REVIEW_DECISION_LABELS: Record<ReviewDecision, string> = {
  approve: 'Approve',
  request_changes: 'Request changes',
  reject: 'Reject',
}

/**
 * Whether a comment is required for the given decision.
 *
 * The spec: "Approve / Request changes / Reject with required comment for
 * last two". Approve does not require a comment; Request changes and
 * Reject do.
 */
export function requiresComment(decision: ReviewDecision): boolean {
  return decision === 'request_changes' || decision === 'reject'
}

// ── Stale-submission guard ─────────────────────────────────────────────────

export interface SubmissionVersionInfo {
  readonly submittedVersion: number
  readonly currentVersion: number
}

export type StaleSubmissionState =
  | { readonly kind: 'fresh' }
  | { readonly kind: 'stale'; readonly submittedVersion: number; readonly currentVersion: number }

/**
 * Whether a submission is stale (the entity has moved on since submission).
 *
 * The spec: "Stale-submission guard (Approve disabled, 'Re-review the
 * current version')". A reviewer who opens a stale submission cannot
 * approve it — they must re-pull the latest version so they approve what
 * they actually see, not what was submitted.
 */
export function checkStaleSubmission(info: SubmissionVersionInfo): StaleSubmissionState {
  if (info.submittedVersion < info.currentVersion) {
    return {
      kind: 'stale',
      submittedVersion: info.submittedVersion,
      currentVersion: info.currentVersion,
    }
  }
  return { kind: 'fresh' }
}

/**
 * Whether the Approve button is enabled given the stale-submission state.
 * Stale submissions disable Approve; Request changes and Reject remain
 * available (a reviewer can still request changes on a stale version).
 */
export function canApprove(staleState: StaleSubmissionState): boolean {
  return staleState.kind === 'fresh'
}

/**
 * The reason text for the disabled Approve button on a stale submission.
 * Rendered in the tooltip AND `aria-describedby`.
 */
export function staleApprovalReason(staleState: StaleSubmissionState): string | null {
  if (staleState.kind === 'fresh') return null
  return `Re-review the current version (v${staleState.currentVersion}) — this submission was v${staleState.submittedVersion}`
}

// ── Self-approval guard ────────────────────────────────────────────────────

export interface ReviewSubmissionContext {
  readonly authorId: string
  readonly currentUserId: string
  readonly availableReviewers: readonly string[]
}

export type SelfApprovalState =
  | { readonly kind: 'can_review' }
  | { readonly kind: 'self_authored'; readonly reason: string }
  | { readonly kind: 'sole_reviewer'; readonly reason: string; readonly reassignable: boolean }

/**
 * Whether the current user can review a submission, given they did not
 * author it and there is at least one other reviewer available.
 *
 * The spec: "A user can never approve a submission they authored. The
 * single-reviewer-authored case: 'Yours — awaiting another reviewer' +
 * Reassign."
 *
 * - `can_review` — the current user is not the author; proceed.
 * - `self_authored` — the current user IS the author; Approve is disabled
 *   with "You can't approve your own submission".
 * - `sole_reviewer` — the current user is the author AND is the only
 *   available reviewer. The row renders "Yours — awaiting another
 *   reviewer" + a Reassign action (the spec calls for reassignment to
 *   another reviewer, not for self-approval).
 */
export function checkSelfApproval(ctx: ReviewSubmissionContext): SelfApprovalState {
  const isAuthor = ctx.authorId === ctx.currentUserId
  if (!isAuthor) return { kind: 'can_review' }

  // The current user authored this submission. Check whether they are the
  // sole available reviewer.
  const otherReviewers = ctx.availableReviewers.filter((id) => id !== ctx.currentUserId)
  if (otherReviewers.length === 0) {
    return {
      kind: 'sole_reviewer',
      reason: 'Yours — awaiting another reviewer',
      reassignable: false,
    }
  }
  return {
    kind: 'self_authored',
    reason: "You can't approve your own submission",
  }
}

/**
 * Whether the Reassign action is available. The spec calls for Reassign
 * on the sole-reviewer case so an admin can add another reviewer.
 */
export function canReassign(state: SelfApprovalState): boolean {
  return state.kind === 'sole_reviewer' || state.kind === 'self_authored'
}

// ── Bulk-approve (never bulk-reject) ───────────────────────────────────────

export interface BulkReviewItem {
  readonly submissionId: string
  readonly decision: ReviewDecision
  readonly comment: string | null
  readonly staleState: StaleSubmissionState
  readonly selfApprovalState: SelfApprovalState
}

export interface BulkReviewOutcome {
  readonly submissionId: string
  readonly outcome: 'decided' | 'skipped_stale' | 'skipped_self'
  readonly reason?: string
}

/**
 * Validate a bulk-review batch. The spec: bulk-approve is allowed; bulk-
 * reject is NOT (rejection requires a per-item comment). This function
 * filters the batch to items that can actually be decided, and returns
 * per-item outcomes for the ones that are skipped.
 *
 * Rules:
 * - All items in a bulk batch MUST have the same decision (you cannot
 *   mix approve and request_changes in one batch).
 * - If the decision is `reject`, the batch is rejected entirely (use
 *   individual rejections instead).
 * - Stale submissions are skipped with `skipped_stale`.
 * - Self-authored submissions are skipped with `skipped_self`.
 */
export function validateBulkReviewBatch(items: readonly BulkReviewItem[]): {
  valid: boolean
  reason: string | null
  outcomes: BulkReviewOutcome[]
} {
  if (items.length === 0) {
    return { valid: false, reason: 'No submissions selected', outcomes: [] }
  }

  const decisions = new Set(items.map((i) => i.decision))
  if (decisions.size > 1) {
    return {
      valid: false,
      reason: 'A bulk batch must use a single decision (cannot mix approve and request_changes)',
      outcomes: [],
    }
  }

  const decision = items[0].decision
  if (decision === 'reject') {
    return {
      valid: false,
      reason:
        'Bulk-reject is not supported — rejection requires a per-item comment. Reject submissions individually.',
      outcomes: [],
    }
  }

  const outcomes: BulkReviewOutcome[] = items.map((item) => {
    if (item.staleState.kind === 'stale') {
      return {
        submissionId: item.submissionId,
        outcome: 'skipped_stale',
        reason: staleApprovalReason(item.staleState) ?? undefined,
      }
    }
    if (item.selfApprovalState.kind !== 'can_review') {
      return {
        submissionId: item.submissionId,
        outcome: 'skipped_self',
        reason: item.selfApprovalState.reason,
      }
    }
    return { submissionId: item.submissionId, outcome: 'decided' }
  })

  return { valid: true, reason: null, outcomes }
}
