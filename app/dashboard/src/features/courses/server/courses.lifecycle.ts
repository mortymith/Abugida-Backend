import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  coursePublishSchema,
  courseReviewDecisionSchema,
  courseReviewSubmitSchema,
  setItemVisibilitySchema,
} from '../schemas/courses.authoring.schema'

export const publishCourse = createServerFn({ method: 'POST' })
  .validator((input: unknown) => coursePublishSchema.parse(input))
  .handler(async ({ data }): Promise<{ coursePublicId: string; scheduled: boolean }> => {
    const { publishCourseImpl } = await import('./courses.lifecycle.impl.server')
    return publishCourseImpl(data)
  })

const coursePublicIdInput = z.object({ coursePublicId: z.string().uuid() })

export const archiveCourse = createServerFn({ method: 'POST' })
  .validator((input: unknown) => coursePublicIdInput.parse(input))
  .handler(async ({ data }): Promise<{ coursePublicId: string }> => {
    const { archiveCourseImpl } = await import('./courses.lifecycle.impl.server')
    return archiveCourseImpl(data.coursePublicId)
  })

export const deleteCourse = createServerFn({ method: 'POST' })
  .validator((input: unknown) => coursePublicIdInput.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { deleteCourseImpl } = await import('./courses.lifecycle.impl.server')
    return deleteCourseImpl(data.coursePublicId)
  })

/** Deep copy: details + curriculum + pricing become a fresh draft (S-2.1/S-2.6 Duplicate). */
export const duplicateCourse = createServerFn({ method: 'POST' })
  .validator((input: unknown) => coursePublicIdInput.parse(input))
  .handler(async ({ data }): Promise<{ coursePublicId: string }> => {
    const { duplicateCourseImpl } = await import('./courses.lifecycle.impl.server')
    return duplicateCourseImpl(data.coursePublicId)
  })

/** Archived → Draft. Never straight back to Published (S-2.22 / S-2.20 Danger zone). */
export const restoreCourse = createServerFn({ method: 'POST' })
  .validator((input: unknown) => coursePublicIdInput.parse(input))
  .handler(async ({ data }): Promise<{ coursePublicId: string }> => {
    const { restoreCourseImpl } = await import('./courses.lifecycle.impl.server')
    return restoreCourseImpl(data.coursePublicId)
  })

/**
 * Published → Draft (S-2.22). Enrolled students keep access and progress for a
 * 14-day grace period; unpublish never revokes an earned certificate.
 */
export const unpublishCourse = createServerFn({ method: 'POST' })
  .validator((input: unknown) => coursePublicIdInput.parse(input))
  .handler(async ({ data }): Promise<{ coursePublicId: string; graceDays: number }> => {
    const { unpublishCourseImpl } = await import('./courses.lifecycle.impl.server')
    return unpublishCourseImpl(data.coursePublicId)
  })

/**
 * Draft → In Review, opening a course-scoped review request. Only meaningful
 * when `requiresApproval` is on; an ungated course publishes directly.
 */
export const submitCourseForReview = createServerFn({ method: 'POST' })
  .validator((input: unknown) => courseReviewSubmitSchema.parse(input))
  .handler(async ({ data }): Promise<{ coursePublicId: string; reviewPublicId: string }> => {
    const { submitCourseForReviewImpl } = await import('./courses.lifecycle.impl.server')
    return submitCourseForReviewImpl(data.coursePublicId, data.submissionNote)
  })

/** In Review → Draft. Every edit is kept; only the request closes. */
export const withdrawCourseReview = createServerFn({ method: 'POST' })
  .validator((input: unknown) => coursePublicIdInput.parse(input))
  .handler(async ({ data }): Promise<{ coursePublicId: string }> => {
    const { withdrawCourseReviewImpl } = await import('./courses.lifecycle.impl.server')
    return withdrawCourseReviewImpl(data.coursePublicId)
  })

/**
 * In Review → Approved: sets `courses.approved_at` while `status` stays
 * `'draft'`, which is what lets a reviewed course sit *between* review and
 * publication. Approval is not publication.
 */
export const approveCourseReview = createServerFn({ method: 'POST' })
  .validator((input: unknown) => courseReviewDecisionSchema.parse(input))
  .handler(async ({ data }): Promise<{ coursePublicId: string }> => {
    const { approveCourseReviewImpl } = await import('./courses.lifecycle.impl.server')
    if (data.decision !== 'approve') {
      throw new Error('DECISION_MISMATCH: use decideCourseReview for a non-approval')
    }
    return approveCourseReviewImpl(data.coursePublicId, data.comment)
  })

/**
 * In Review → Draft on a reviewer's decision. A comment is required — schema
 * level, so the empty-comment case cannot reach the server at all.
 */
export const decideCourseReview = createServerFn({ method: 'POST' })
  .validator((input: unknown) => courseReviewDecisionSchema.parse(input))
  .handler(async ({ data }): Promise<{ coursePublicId: string }> => {
    const { requestCourseChangesImpl } = await import('./courses.lifecycle.impl.server')
    if (data.decision === 'approve') {
      throw new Error('DECISION_MISMATCH: use approveCourseReview for an approval')
    }
    return requestCourseChangesImpl(data.coursePublicId, data.comment)
  })

/**
 * S-2.17 per-item visibility. Publishes or unpublishes **one** item and never
 * the course; the course must not be In Review, where the Field Lock table
 * makes the control absent.
 */
export const setItemVisibility = createServerFn({ method: 'POST' })
  .validator((input: unknown) => setItemVisibilitySchema.parse(input))
  .handler(
    async ({
      data,
    }): Promise<{
      lessonPublicId: string
      visibility: 'draft' | 'published' | 'scheduled'
    }> => {
      const { setItemVisibilityImpl } = await import('./courses.lifecycle.impl.server')
      return setItemVisibilityImpl(data)
    },
  )
