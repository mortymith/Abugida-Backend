import { queryOptions } from '@tanstack/react-query'
import { getNotifications, getUnreadNotificationCount } from './server/notifications'
import type { NotificationsTab } from './notifications.types'

export const notificationsQueryKeys = {
  list: (tab: NotificationsTab, page: number) => ['notifications', 'list', tab, page] as const,
  unreadCount: () => ['notifications', 'unread-count'] as const,
}

/** Bell badge — poll every 30s so new items surface without refresh (S-1.4). */
export function unreadNotificationCountOptions() {
  return queryOptions({
    queryKey: notificationsQueryKeys.unreadCount(),
    queryFn: () => getUnreadNotificationCount(),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
}

export function notificationsListOptions(tab: NotificationsTab, page: number) {
  return queryOptions({
    queryKey: notificationsQueryKeys.list(tab, page),
    queryFn: () => getNotifications({ data: { tab, page } }),
    staleTime: 15_000,
  })
}
