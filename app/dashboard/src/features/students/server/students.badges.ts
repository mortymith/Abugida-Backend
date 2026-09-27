import { createServerFn } from '@tanstack/react-start'
import type { BadgeCard } from '../students.types'
import {
  badgeAwardSchema,
  badgeHistoryQuerySchema,
  badgeSaveSchema,
  badgeStatusChangeSchema,
  badgeTriggerPreviewSchema,
} from '../schemas/students.schema'

/** Client-safe S-4.7 Badges & Achievements server functions. */

export const getBadges = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ items: BadgeCard[] }> => {
    const { getBadgesImpl } = await import('./students.badges.impl.server')
    return getBadgesImpl()
  },
)

export const saveBadge = createServerFn({ method: 'POST' })
  .validator((input: unknown) => badgeSaveSchema.parse(input))
  .handler(async ({ data }) => {
    const { saveBadgeImpl } = await import('./students.badges.impl.server')
    return saveBadgeImpl(data)
  })

export const setBadgeStatus = createServerFn({ method: 'POST' })
  .validator((input: unknown) => badgeStatusChangeSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { setBadgeStatusImpl } = await import('./students.badges.impl.server')
    return setBadgeStatusImpl(data)
  })

export const previewBadgeTrigger = createServerFn({ method: 'POST' })
  .validator((input: unknown) => badgeTriggerPreviewSchema.parse(input))
  .handler(async ({ data }) => {
    const { previewBadgeTriggerImpl } = await import('./students.badges.impl.server')
    return previewBadgeTriggerImpl(data)
  })

export const evaluateBadges = createServerFn({ method: 'POST' }).handler(
  async (): Promise<{ evaluated: number; awarded: number }> => {
    const { evaluateBadgesImpl } = await import('./students.badges.impl.server')
    return evaluateBadgesImpl()
  },
)

export const awardBadge = createServerFn({ method: 'POST' })
  .validator((input: unknown) => badgeAwardSchema.parse(input))
  .handler(async ({ data }) => {
    const { awardBadgeImpl } = await import('./students.badges.impl.server')
    return awardBadgeImpl(data)
  })

export const getBadgeHistory = createServerFn({ method: 'GET' })
  .validator((input: unknown) => badgeHistoryQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { getBadgeHistoryImpl } = await import('./students.badges.impl.server')
    return getBadgeHistoryImpl(data)
  })
