import { createServerFn } from '@tanstack/react-start'
import {
  affiliateDecisionSchema,
  affiliateFraudSchema,
  affiliateInviteSchema,
  affiliateLinkSchema,
  affiliateStatusChangeSchema,
  programSettingsSchema,
} from '../schemas/marketing.schema'

/** Client-safe S-8.4 Affiliate Program server functions. */

export const getAffiliateProgram = createServerFn({ method: 'GET' }).handler(async () => {
  const { getAffiliateProgramImpl } = await import('./marketing.affiliates.impl.server')
  return getAffiliateProgramImpl()
})

export const listAffiliates = createServerFn({ method: 'GET' })
  .validator((input: unknown) => (typeof input === 'string' ? { status: input } : (input ?? {})))
  .handler(async ({ data }) => {
    const { listAffiliatesImpl } = await import('./marketing.affiliates.impl.server')
    return listAffiliatesImpl(data)
  })

export const saveProgramSettings = createServerFn({ method: 'POST' })
  .validator((input: unknown) => programSettingsSchema.parse(input))
  .handler(async ({ data }) => {
    const { saveProgramSettingsImpl } = await import('./marketing.affiliates.impl.server')
    return saveProgramSettingsImpl(data)
  })

export const inviteAffiliate = createServerFn({ method: 'POST' })
  .validator((input: unknown) => affiliateInviteSchema.parse(input))
  .handler(async ({ data }) => {
    const { inviteAffiliateImpl } = await import('./marketing.affiliates.impl.server')
    return inviteAffiliateImpl(data)
  })

export const decideAffiliate = createServerFn({ method: 'POST' })
  .validator((input: unknown) => affiliateDecisionSchema.parse(input))
  .handler(async ({ data }) => {
    const { decideAffiliateImpl } = await import('./marketing.affiliates.impl.server')
    return decideAffiliateImpl(data)
  })

export const updateAffiliateStatus = createServerFn({ method: 'POST' })
  .validator((input: unknown) => affiliateStatusChangeSchema.parse(input))
  .handler(async ({ data }) => {
    const { updateAffiliateStatusImpl } = await import('./marketing.affiliates.impl.server')
    return updateAffiliateStatusImpl(data)
  })

export const flagAffiliateFraud = createServerFn({ method: 'POST' })
  .validator((input: unknown) => affiliateFraudSchema.parse(input))
  .handler(async ({ data }) => {
    const { flagAffiliateFraudImpl } = await import('./marketing.affiliates.impl.server')
    return flagAffiliateFraudImpl(data)
  })

export const generateAffiliateLink = createServerFn({ method: 'POST' })
  .validator((input: unknown) => affiliateLinkSchema.parse(input))
  .handler(async ({ data }) => {
    const { generateAffiliateLinkImpl } = await import('./marketing.affiliates.impl.server')
    return generateAffiliateLinkImpl(data)
  })

export const getPendingPayouts = createServerFn({ method: 'GET' }).handler(async () => {
  const { getPendingPayoutsImpl } = await import('./marketing.affiliates.impl.server')
  return getPendingPayoutsImpl()
})

export const runPayouts = createServerFn({ method: 'POST' }).handler(async () => {
  const { runPayoutsImpl } = await import('./marketing.affiliates.impl.server')
  return runPayoutsImpl()
})

export const getPayoutHistory = createServerFn({ method: 'GET' }).handler(async () => {
  const { getPayoutHistoryImpl } = await import('./marketing.affiliates.impl.server')
  return getPayoutHistoryImpl()
})
