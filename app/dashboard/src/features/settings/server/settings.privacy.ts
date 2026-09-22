import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type {
  ConsentLogPage,
  DataRequestsPage,
  PrivacyPage,
  RetentionPreview,
} from '../settings.types'
import {
  createDataRequestSchema,
  dataRequestIdSchema,
  saveRetentionPolicySchema,
  typedEraseSchema,
} from '../schemas/settings.schema'

const consentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
})

/**
 * Client-safe S-6.10 Privacy & Data Retention server functions. Retention
 * execution, exports, and erasures are dual-confirmed and audited per spec.
 */

export const getPrivacyPage = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PrivacyPage> => {
    const { getPrivacyPageImpl } = await import('./settings.privacy.impl.server')
    return getPrivacyPageImpl()
  },
)

export const saveRetentionPolicy = createServerFn({ method: 'POST' })
  .validator((input: unknown) => saveRetentionPolicySchema.parse(input))
  .handler(async ({ data }) => {
    const { saveRetentionPolicyImpl } = await import('./settings.privacy.impl.server')
    return saveRetentionPolicyImpl(data)
  })

export const previewRetentionMatches = createServerFn({ method: 'POST' }).handler(
  async (): Promise<RetentionPreview> => {
    const { previewRetentionMatchesImpl } = await import('./settings.privacy.impl.server')
    return previewRetentionMatchesImpl()
  },
)

export const getDataRequests = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DataRequestsPage> => {
    const { getDataRequestsImpl } = await import('./settings.privacy.impl.server')
    return getDataRequestsImpl()
  },
)

export const createDataRequest = createServerFn({ method: 'POST' })
  .validator((input: unknown) => createDataRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const { createDataRequestImpl } = await import('./settings.privacy.impl.server')
    return createDataRequestImpl(data)
  })

export const completeDataExport = createServerFn({ method: 'POST' })
  .validator((input: unknown) => dataRequestIdSchema.parse(input))
  .handler(async ({ data }): Promise<{ fileName: string; json: string }> => {
    const { completeDataExportImpl } = await import('./settings.privacy.impl.server')
    return completeDataExportImpl(data)
  })

export const eraseStudentData = createServerFn({ method: 'POST' })
  .validator((input: unknown) => typedEraseSchema.parse(input))
  .handler(async ({ data }) => {
    const { eraseStudentDataImpl } = await import('./settings.privacy.impl.server')
    return eraseStudentDataImpl(data)
  })

export const getConsentLog = createServerFn({ method: 'GET' })
  .validator((input: unknown) => consentQuerySchema.parse(input))
  .handler(async ({ data }): Promise<ConsentLogPage> => {
    const { getConsentLogImpl } = await import('./settings.privacy.impl.server')
    return getConsentLogImpl(data)
  })
