/**
 * Bulk-approve exclusions + capacity-race resolution (spec 06 § S-4.6).
 *
 * The spec:
 * - "Bulk-approve confirms the final count after every exclusion.
 *   Exclusions are computed before the dialog opens — already enrolled,
 *   course unpublished, cohort archived, consent withdrawn — and the
 *   dialog names each."
 * - "Capacity race: the honest outcome when a seat is contested — '3
 *   students were approved for the last seat. 1 was admitted, 2 moved to
 *   the waitlist.' The race is resolved server-side in one transaction."
 */

export type ExclusionReason =
  | 'already_enrolled'
  | 'course_unpublished'
  | 'cohort_archived'
  | 'consent_withdrawn'
  | 'course_full'
  | 'duplicate_request'

export const EXCLUSION_REASON_LABELS: Record<ExclusionReason, string> = {
  already_enrolled: 'already enrolled',
  course_unpublished: 'course unpublished',
  cohort_archived: 'cohort archived',
  consent_withdrawn: 'consent withdrawn',
  course_full: 'course full',
  duplicate_request: 'duplicate request',
}

export interface EnrollmentRequestCandidate {
  readonly requestId: string
  readonly studentId: string
  readonly studentName: string
  readonly courseId: string
  readonly courseName: string
  readonly cohortId: string | null
}

export interface ExclusionContext {
  readonly enrolledStudentIds: ReadonlySet<string> // already enrolled in this course
  readonly unpublishedCourseIds: ReadonlySet<string>
  readonly archivedCohortIds: ReadonlySet<string>
  readonly withdrawnConsentStudentIds: ReadonlySet<string>
  readonly courseCapacity: number | null
  readonly currentEnrollmentCount: number
}

export interface BulkApproveExclusion {
  readonly request: EnrollmentRequestCandidate
  readonly reason: ExclusionReason
}

export interface BulkApprovePlan {
  readonly toApprove: readonly EnrollmentRequestCandidate[]
  readonly excluded: readonly BulkApproveExclusion[]
  readonly finalCount: number
}

/**
 * Compute exclusions for a bulk-approve batch. The spec: "Exclusions are
 * computed before the dialog opens." Returns the list of requests that
 * can actually be approved + the excluded requests with reasons.
 */
export function computeBulkApproveExclusions(
  requests: readonly EnrollmentRequestCandidate[],
  ctx: ExclusionContext,
): BulkApprovePlan {
  const toApprove: EnrollmentRequestCandidate[] = []
  const excluded: BulkApproveExclusion[] = []

  for (const request of requests) {
    if (ctx.enrolledStudentIds.has(request.studentId)) {
      excluded.push({ request, reason: 'already_enrolled' })
      continue
    }
    if (ctx.unpublishedCourseIds.has(request.courseId)) {
      excluded.push({ request, reason: 'course_unpublished' })
      continue
    }
    if (request.cohortId && ctx.archivedCohortIds.has(request.cohortId)) {
      excluded.push({ request, reason: 'cohort_archived' })
      continue
    }
    if (ctx.withdrawnConsentStudentIds.has(request.studentId)) {
      excluded.push({ request, reason: 'consent_withdrawn' })
      continue
    }
    toApprove.push(request)
  }

  // Capacity check: if the course is full, all toApprove are excluded as
  // course_full (they'd be added to the waitlist instead).
  if (ctx.courseCapacity !== null && toApprove.length > 0) {
    const seatsAvailable = Math.max(0, ctx.courseCapacity - ctx.currentEnrollmentCount)
    if (toApprove.length > seatsAvailable) {
      // The first `seatsAvailable` are approved; the rest are excluded.
      const approved = toApprove.slice(0, seatsAvailable)
      const fullExcluded = toApprove.slice(seatsAvailable)
      for (const request of fullExcluded) {
        excluded.push({ request, reason: 'course_full' })
      }
      return {
        toApprove: approved,
        excluded,
        finalCount: approved.length,
      }
    }
  }

  return { toApprove, excluded, finalCount: toApprove.length }
}

/**
 * The bulk-approve confirmation message. The spec: "Approve 2 requests?
 * 2 will be enrolled. 1 skipped: Daniel W. is already enrolled in TOEFL
 * Complete."
 */
export function bulkApproveConfirmationMessage(plan: BulkApprovePlan): string {
  const { toApprove, excluded, finalCount } = plan
  if (excluded.length === 0) {
    return `Approve ${toApprove.length} request${toApprove.length === 1 ? '' : 's'}? ${finalCount} will be enrolled.`
  }
  const exclusionLines = excluded.map(
    (e) =>
      `${e.request.studentName} is ${EXCLUSION_REASON_LABELS[e.reason]}${
        e.reason === 'already_enrolled' ? ` in ${e.request.courseName}` : ''
      }`,
  )
  return `Approve ${toApprove.length} request${toApprove.length === 1 ? '' : 's'}? ${finalCount} will be enrolled. ${excluded.length} skipped: ${exclusionLines.join('; ')}.`
}

// ── Capacity race ──────────────────────────────────────────────────────────

export interface CapacityRaceResult {
  readonly admitted: EnrollmentRequestCandidate
  readonly movedToWaitlist: ReadonlyArray<{
    request: EnrollmentRequestCandidate
    position: number
  }>
}

/**
 * Resolve a capacity race. The spec: "3 students were approved for the
 * last seat. 1 was admitted, 2 moved to the waitlist." The race is
 * resolved server-side in one transaction; this function computes the
 * outcome given the contested requests.
 *
 * The admitted student is the one with the earliest `requestedAt` (first-
 * come, first-served). The rest are moved to the waitlist in order.
 */
export function resolveCapacityRace(
  contestedRequests: ReadonlyArray<EnrollmentRequestCandidate & { requestedAt: number }>,
): CapacityRaceResult {
  if (contestedRequests.length === 0) {
    throw new Error('Cannot resolve a capacity race with no contested requests')
  }
  const sorted = [...contestedRequests].sort((a, b) => a.requestedAt - b.requestedAt)
  const admitted = sorted[0]
  const movedToWaitlist = sorted.slice(1).map((request, index) => ({
    request,
    position: index + 1,
  }))
  return { admitted, movedToWaitlist }
}

/**
 * The capacity-race message. The spec: "3 students were approved for the
 * last seat. 1 was admitted, 2 moved to the waitlist."
 */
export function capacityRaceMessage(result: CapacityRaceResult): string {
  const total = 1 + result.movedToWaitlist.length
  const admitted = result.admitted.studentName
  const moved = result.movedToWaitlist.map((m) => m.request.studentName).join(', ')
  return `${total} student${total === 1 ? ' was' : 's were'} approved for the last seat. 1 was admitted (${admitted}), ${result.movedToWaitlist.length} moved to the waitlist (${moved}).`
}

/**
 * The "Course full" case-2 state message. The spec: "IELTS Advanced is
 * full (24/24). Approve anyway to add to the waitlist?"
 */
export function courseFullMessage(courseName: string, capacity: number, current: number): string {
  return `${courseName} is full (${current}/${capacity}). Approve anyway to add to the waitlist?`
}
