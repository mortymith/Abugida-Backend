import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { NotificationsPage } from '../notifications.types'

/**
 * Server functions for S-1.4 Notifications Center. Implementation lives in
 * the server-only impl module, dynamically imported inside handlers so this
 * file stays safe for the client bundle.
 */

const listInputSchema = z.object({
  tab: z.enum(['all', 'mentions', 'system']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
})

export const getNotifications = createServerFn({ method: 'GET' })
  .validator((input: unknown) => listInputSchema.parse(input))
  .handler(async ({ data }): Promise<NotificationsPage> => {
    const { listNotifications } = await import('./notifications.impl.server')
    return listNotifications(data)
  })

export const getUnreadNotificationCount = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ count: number }> => {
    const { unreadCount } = await import('./notifications.impl.server')
    return unreadCount()
  },
)

export const markNotificationRead = createServerFn({ method: 'POST' })
  .validator((input: unknown) => z.object({ publicId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ success: true }> => {
    const { markRead } = await import('./notifications.impl.server')
    return markRead(data.publicId)
  })

export const markAllNotificationsRead = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z.object({ tab: z.enum(['all', 'mentions', 'system']) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ success: true }> => {
    const { markAllRead } = await import('./notifications.impl.server')
    return markAllRead(data.tab)
  })
