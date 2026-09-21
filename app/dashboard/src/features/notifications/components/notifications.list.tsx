import { useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Book01Icon,
  CreditCardIcon,
  NotificationIcon,
  RocketIcon,
  BubbleChatIcon,
  UserGroupIcon,
  StudentsIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { EmptyState } from '#/components/common/empty-state'
import { Skeleton } from '#/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import type { NotificationItem, NotificationType, NotificationsTab } from '../notifications.types'

const TYPE_ICONS: Record<NotificationType, typeof Book01Icon> = {
  enrollment: StudentsIcon,
  payment: CreditCardIcon,
  publish: RocketIcon,
  mention: BubbleChatIcon,
  system: NotificationIcon,
  team_invite: UserGroupIcon,
  review: Book01Icon,
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

/**
 * Notifications Center feed (S-1.4): tabs, unread dots, deep links, and
 * mark-all-as-read. Rows are buttons so keyboard users can activate them.
 */
export function NotificationsList({
  items,
  unreadCount,
  activeTab,
  onTabChange,
  onSelect,
  onMarkAllRead,
  isMarkingAllRead,
}: {
  items: NotificationItem[]
  unreadCount: number
  activeTab: NotificationsTab
  onTabChange: (tab: NotificationsTab) => void
  onSelect: (item: NotificationItem) => void
  onMarkAllRead: () => void
  isMarkingAllRead: boolean
}) {
  const navigate = useNavigate()

  return (
    <Card className="gap-4 py-6">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-6">
        <CardTitle className="text-lg font-semibold">Notifications</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onMarkAllRead}
          disabled={isMarkingAllRead || unreadCount === 0}
        >
          Mark all as read
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-3">
        <div className="flex items-center justify-between gap-2 px-3">
          <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as NotificationsTab)}>
            <TabsList aria-label="Filter notifications">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="mentions">Mentions</TabsTrigger>
              <TabsTrigger value="system">System</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Notification preferences"
            title="Notification preferences (Settings → Notifications, coming with S-6.1)"
            onClick={() => navigate({ to: '/dashboard' })}
          >
            <HugeiconsIcon icon={NotificationIcon} size={18} strokeWidth={1.5} />
          </Button>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={<HugeiconsIcon icon={NotificationIcon} size={24} strokeWidth={1.5} />}
            title="You're all caught up."
            description="New enrollments, payments, and publish events will appear here."
          />
        ) : (
          <ul className="flex flex-col">
            {items.map((item) => {
              const Icon = TYPE_ICONS[item.type]
              return (
                <li key={item.publicId}>
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className={cnRow(item.isRead)}
                    aria-label={`${item.title}${item.isRead ? '' : ' (unread)'}`}
                  >
                    <span
                      aria-hidden="true"
                      className={
                        item.isRead
                          ? 'size-2 shrink-0 rounded-full bg-transparent'
                          : 'size-2 shrink-0 rounded-full bg-primary'
                      }
                    />
                    <HugeiconsIcon
                      icon={Icon}
                      size={20}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      {item.body ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.body}
                        </span>
                      ) : null}
                    </span>
                    <time
                      className="shrink-0 text-xs text-muted-foreground"
                      dateTime={item.createdAt}
                    >
                      {relativeTime(item.createdAt)}
                    </time>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function cnRow(isRead: boolean): string {
  return [
    'flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors min-h-10',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    isRead ? 'opacity-70 hover:bg-muted/50' : 'bg-accent/40 hover:bg-muted',
  ].join(' ')
}

export function NotificationsSkeleton() {
  return (
    <div className="space-y-2 px-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  )
}
