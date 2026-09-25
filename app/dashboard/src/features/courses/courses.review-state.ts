import type { ReviewDecision } from './schemas/courses.workflow.schema'

/**
 * Review lifecycle state machine (spec 04 S-2.14):
 * Draft → In Review → (Changes Requested → In Review)* → Approved → Published.
 * `reject` returns the lesson to `draft` (author edits and re-submits).
 */

export type LessonReviewStatus = 'draft' | 'in_review' | 'changes_requested' | 'approved'

export interface ReviewTransition {
  lessonStatus: LessonReviewStatus
}

export function applyReviewDecision(
  current: LessonReviewStatus,
  decision: ReviewDecision,
): ReviewTransition {
  switch (decision) {
    case 'approve':
      if (current !== 'in_review') {
        throw new Error(`Cannot approve a lesson in state "${current}"`)
      }
      return { lessonStatus: 'approved' }
    case 'request_changes':
      if (current !== 'in_review') {
        throw new Error(`Cannot request changes on a lesson in state "${current}"`)
      }
      return { lessonStatus: 'changes_requested' }
    case 'reject':
      if (current !== 'in_review') {
        throw new Error(`Cannot reject a lesson in state "${current}"`)
      }
      return { lessonStatus: 'draft' }
  }
}

export function canSubmitForReview(status: LessonReviewStatus): boolean {
  return status === 'draft' || status === 'changes_requested'
}

/** Reviewer decision buttons stay disabled until the preview was opened (spec). */
export function canDecide(previewOpened: boolean): boolean {
  return previewOpened
}

export const REVIEW_STATE_LABELS: Record<LessonReviewStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
}
