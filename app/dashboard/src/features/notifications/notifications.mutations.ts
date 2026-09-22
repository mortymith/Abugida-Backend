import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '#/components/common/toast'
import { markAllNotificationsRead, markNotificationRead } from './server/notifications'
import {
  notificationsListOptions,
  notificationsQueryKeys,
  unreadNotificationCountOptions,
} from './notifications.queries'
import type { NotificationsTab, NotificationsPage } from './notifications.types'

/**
 * Optimistic mark-as-read (spec 11): update instantly, roll back with an
 * error toast on failure. The unread badge and every cached list page are
 * reconciled together so the UI never disagrees with itself.
 */
function useOptimisticNotifications(tab: NotificationsTab, page: number) {
  const queryClient = useQueryClient()

  function applyReadState(
    publicId: string | null,
    markAll: boolean,
    isRead: boolean,
  ): { previousBadge?: { count: number }; previousList?: NotificationsPage } {
    const badgeKey = notificationsQueryKeys.unreadCount()
    const listKey = notificationsQueryKeys.list(tab, page)

    const previousBadge = queryClient.getQueryData<{ count: number }>(badgeKey)
    const previousList = queryClient.getQueryData<NotificationsPage>(listKey)

    if (previousList) {
      const items = previousList.items.map((item) => {
        if (markAll || item.publicId === publicId) return { ...item, isRead }
        return item
      })
      const nextUnread = items.filter((item) => !item.isRead).length
      queryClient.setQueryData<NotificationsPage>(listKey, {
        ...previousList,
        items,
        unreadCount: markAll ? (isRead ? 0 : previousList.unreadCount) : nextUnread,
      })
      queryClient.setQueryData<{ count: number }>(badgeKey, {
        count: markAll
          ? isRead
            ? 0
            : (previousBadge?.count ?? 0)
          : Math.max((previousBadge?.count ?? 1) - 1, 0),
      })
    }

    return { previousBadge, previousList }
  }

  const markRead = useMutation({
    mutationFn: (publicId: string) => markNotificationRead({ data: { publicId } }),
    onMutate: (publicId) => applyReadState(publicId, false, true),
    onError: (_error, _publicId, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(notificationsQueryKeys.list(tab, page), context.previousList)
      }
      if (context?.previousBadge) {
        queryClient.setQueryData(notificationsQueryKeys.unreadCount(), context.previousBadge)
      }
      toast.error("Couldn't mark the notification as read. Retry?")
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.unreadCount() })
    },
  })

  const markAllRead = useMutation({
    mutationFn: (targetTab: NotificationsTab) =>
      markAllNotificationsRead({ data: { tab: targetTab } }),
    onMutate: () => applyReadState(null, true, true),
    onError: (_error, _tab, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(notificationsQueryKeys.list(tab, page), context.previousList)
      }
      if (context?.previousBadge) {
        queryClient.setQueryData(notificationsQueryKeys.unreadCount(), context.previousBadge)
      }
      toast.error("Couldn't mark notifications as read. Retry?")
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsQueryKeys.unreadCount() })
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] })
    },
  })

  return { markRead, markAllRead }
}

export function useNotificationsList(tab: NotificationsTab, page: number) {
  const listQuery = useQuery(notificationsListOptions(tab, page))
  const { markRead, markAllRead } = useOptimisticNotifications(tab, page)
  return { listQuery, markRead, markAllRead }
}

export function useUnreadNotificationCount() {
  return useQuery(unreadNotificationCountOptions())
}
