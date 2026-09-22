import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { toast } from '#/components/common/toast'
import {
  useNotificationsList,
  NotificationsList,
  NotificationsSkeleton,
  notificationsQueryKeys,
  notificationsListOptions,
} from '#/features/notifications'
import { resolveEntityLink } from '#/lib/entity-links'
import type { LinkableEntityType } from '#/lib/entity-links'
import type { NotificationsTab } from '#/features/notifications'

const notificationsSearchSchema = z.object({
  tab: z.enum(['all', 'mentions', 'system']).optional(),
  page: z.coerce.number().int().min(1).optional(),
})

export const Route = createFileRoute('/_app/notifications')({
  validateSearch: notificationsSearchSchema,
  loaderDeps: ({ search }) => ({ tab: search.tab ?? 'all', page: search.page ?? 1 }),
  loader: ({ context, deps }) =>
    // Warm the cache; failures surface through the component query.
    Promise.allSettled([
      context.queryClient.ensureQueryData(notificationsListOptions(deps.tab, deps.page)),
    ]),
  component: NotificationsCenterPage,
})

/**
 * S-1.4 Notifications Center: All / Mentions / System tabs with unread
 * indicators, mark-all-as-read, and typed deep links back to source screens.
 */
function NotificationsCenterPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const queryClient = useQueryClient()
  const search = Route.useSearch()
  const tab = search.tab ?? 'all'
  const page = search.page ?? 1

  const { listQuery, markRead, markAllRead } = useNotificationsList(tab, page)

  function handleTabChange(nextTab: NotificationsTab) {
    navigate({ search: { tab: nextTab === 'all' ? undefined : nextTab, page: undefined } })
  }

  function handleSelect(item: {
    publicId: string
    title: string
    url: string
    exists: boolean
    linkEntityType: string | null
    linkEntityPublicId: string | null
    isRead: boolean
  }) {
    if (!item.isRead) markRead.mutate(item.publicId)

    if (item.linkEntityType && item.linkEntityPublicId) {
      const link = resolveEntityLink(
        item.linkEntityType as LinkableEntityType,
        item.linkEntityPublicId,
      )
      if (link.exists) {
        queryClient.removeQueries({ queryKey: notificationsQueryKeys.unreadCount() })
        navigate({ to: link.path })
        return
      }
      toast.info(`“${item.title}” opens here once its module ships.`)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      {listQuery.isLoading ? (
        <NotificationsSkeleton />
      ) : listQuery.isError ? (
        <div role="alert" className="rounded-lg border border-destructive/30 p-6 text-center">
          <p className="text-sm font-medium">Unable to load notifications.</p>
          <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
        </div>
      ) : listQuery.data ? (
        <NotificationsList
          items={listQuery.data.items}
          unreadCount={listQuery.data.unreadCount}
          activeTab={listQuery.data.tab}
          onTabChange={handleTabChange}
          onSelect={handleSelect}
          onMarkAllRead={() => markAllRead.mutate(tab)}
          isMarkingAllRead={markAllRead.isPending}
        />
      ) : null}
    </div>
  )
}
