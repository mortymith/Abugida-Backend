import { createServerFn } from '@tanstack/react-start'
import type { WaitlistOverviewItem } from '../students.types'
import {
  bulkApproveSchema,
  promoteWaitlistSchema,
  requestDecisionSchema,
  requestsQuerySchema,
} from '../schemas/students.schema'

/** Client-safe S-4.6 Enrollment Requests / Waitlist server functions. */

export const getEnrollmentRequests = createServerFn({ method: 'GET' })
  .validator((input: unknown) => requestsQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { getEnrollmentRequestsImpl } = await import('./students.requests.impl.server')
    return getEnrollmentRequestsImpl(data)
  })

export const approveRequest = createServerFn({ method: 'POST' })
  .validator((input: unknown) => requestDecisionSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { decideRequestImpl } = await import('./students.requests.impl.server')
    return decideRequestImpl({ ...data, decision: 'approved' })
  })

export const denyRequest = createServerFn({ method: 'POST' })
  .validator((input: unknown) => requestDecisionSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { decideRequestImpl } = await import('./students.requests.impl.server')
    return decideRequestImpl({ ...data, decision: 'denied' })
  })

export const bulkApproveRequests = createServerFn({ method: 'POST' })
  .validator((input: unknown) => bulkApproveSchema.parse(input))
  .handler(async ({ data }) => {
    const { bulkApproveRequestsImpl } = await import('./students.requests.impl.server')
    return bulkApproveRequestsImpl(data)
  })

export const getWaitlistOverview = createServerFn({ method: 'GET' }).handler(
  async (): Promise<WaitlistOverviewItem[]> => {
    const { getWaitlistOverviewImpl } = await import('./students.requests.impl.server')
    return getWaitlistOverviewImpl()
  },
)

export const promoteFromWaitlist = createServerFn({ method: 'POST' })
  .validator((input: unknown) => promoteWaitlistSchema.parse(input))
  .handler(async ({ data }) => {
    const { promoteFromWaitlistImpl } = await import('./students.requests.impl.server')
    return promoteFromWaitlistImpl(data)
  })
