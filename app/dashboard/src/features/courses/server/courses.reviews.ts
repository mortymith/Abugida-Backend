import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  approvalGateSchema,
  reviewDecisionInputSchema,
  reviewQueueQuerySchema,
  submitForReviewSchema,
} from '../schemas/courses.workflow.schema'
import type { ReviewLessonPreview, ReviewQueueItem } from '../courses.types'

const lessonInputSchema = z.object({ lessonPublicId: z.string().uuid() })

export const getReviewQueue = createServerFn({ method: 'GET' })
  .validator((input: unknown) => reviewQueueQuerySchema.parse(input))
  .handler(async ({ data }): Promise<ReviewQueueItem[]> => {
    const { getReviewQueueImpl } = await import('./courses.reviews.impl.server')
    return getReviewQueueImpl(data)
  })

/** Student-accurate lesson preview for the review panel. */
export const getReviewLessonPreview = createServerFn({ method: 'GET' })
  .validator((input: unknown) => lessonInputSchema.parse(input))
  .handler(async ({ data }): Promise<ReviewLessonPreview> => {
    const { getReviewLessonPreviewImpl } = await import('./courses.reviews.impl.server')
    return getReviewLessonPreviewImpl(data.lessonPublicId)
  })

export const submitForReview = createServerFn({ method: 'POST' })
  .validator((input: unknown) => submitForReviewSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { submitForReviewImpl } = await import('./courses.reviews.impl.server')
    return submitForReviewImpl(data)
  })

export const decideReview = createServerFn({ method: 'POST' })
  .validator((input: unknown) => reviewDecisionInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { decideReviewImpl } = await import('./courses.reviews.impl.server')
    return decideReviewImpl(data)
  })

/** Workflow gear (S-2.14): toggle per-course approval gating (admin only). */
export const setApprovalGate = createServerFn({ method: 'POST' })
  .validator((input: unknown) => approvalGateSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { setApprovalGateImpl } = await import('./courses.reviews.impl.server')
    return setApprovalGateImpl(data)
  })

/** Sidebar badge: pending review count (S-A.1 Courses badge). */
export const getPendingReviewCount = createServerFn({ method: 'GET' }).handler(
  async (): Promise<number> => {
    const { getPendingReviewCountImpl } = await import('./courses.reviews.impl.server')
    return getPendingReviewCountImpl()
  },
)
