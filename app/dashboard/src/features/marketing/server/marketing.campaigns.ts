import { createServerFn } from '@tanstack/react-start'
import {
  audiencePreviewSchema,
  campaignCreateSchema,
  campaignPublicIdSchema,
  campaignScheduleSchema,
  campaignSendTestSchema,
  campaignUpdateSchema,
  campaignsQuerySchema,
} from '../schemas/marketing.schema'

/** Client-safe S-8.1 Email Campaigns server functions. */

export const getCampaigns = createServerFn({ method: 'GET' })
  .validator((input: unknown) => campaignsQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { getCampaignsImpl } = await import('./marketing.campaigns.impl.server')
    return getCampaignsImpl(data)
  })

export const getCampaign = createServerFn({ method: 'GET' })
  .validator((input: unknown) => campaignPublicIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { getCampaignImpl } = await import('./marketing.campaigns.impl.server')
    return getCampaignImpl(data)
  })

export const createCampaign = createServerFn({ method: 'POST' })
  .validator((input: unknown) => campaignCreateSchema.parse(input))
  .handler(async ({ data }) => {
    const { createCampaignImpl } = await import('./marketing.campaigns.impl.server')
    return createCampaignImpl(data)
  })

export const updateCampaign = createServerFn({ method: 'POST' })
  .validator((input: unknown) => campaignUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const { updateCampaignImpl } = await import('./marketing.campaigns.impl.server')
    return updateCampaignImpl(data)
  })

export const scheduleCampaign = createServerFn({ method: 'POST' })
  .validator((input: unknown) => campaignScheduleSchema.parse(input))
  .handler(async ({ data }) => {
    const { scheduleCampaignImpl } = await import('./marketing.campaigns.impl.server')
    return scheduleCampaignImpl(data)
  })

export const cancelScheduledCampaign = createServerFn({ method: 'POST' })
  .validator((input: unknown) => campaignPublicIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { cancelScheduledCampaignImpl } = await import('./marketing.campaigns.impl.server')
    return cancelScheduledCampaignImpl(data)
  })

export const duplicateCampaign = createServerFn({ method: 'POST' })
  .validator((input: unknown) => campaignPublicIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { duplicateCampaignImpl } = await import('./marketing.campaigns.impl.server')
    return duplicateCampaignImpl(data)
  })

export const sendCampaignNow = createServerFn({ method: 'POST' })
  .validator((input: unknown) => campaignPublicIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { sendCampaignNowImpl } = await import('./marketing.campaigns.impl.server')
    return sendCampaignNowImpl(data)
  })

export const sendTestCampaign = createServerFn({ method: 'POST' })
  .validator((input: unknown) => campaignSendTestSchema.parse(input))
  .handler(async ({ data }) => {
    const { sendTestCampaignImpl } = await import('./marketing.campaigns.impl.server')
    return sendTestCampaignImpl(data)
  })

export const previewAudience = createServerFn({ method: 'POST' })
  .validator((input: unknown) => audiencePreviewSchema.parse(input))
  .handler(async ({ data }) => {
    const { previewAudienceImpl } = await import('./marketing.campaigns.impl.server')
    return previewAudienceImpl(data)
  })

export const getComposerReference = createServerFn({ method: 'GET' }).handler(async () => {
  const { getComposerReferenceImpl } = await import('./marketing.campaigns.impl.server')
  return getComposerReferenceImpl()
})
