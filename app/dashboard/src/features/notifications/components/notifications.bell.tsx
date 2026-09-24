import { useRouter } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { NotificationIcon } from '@hugeicons/core-free-icons'
import { cn } from 'cn'
import { useUnreadNotificationCount } from '../notifications.mutations'

/**
 * Notification bell (spec 11): header icon with unread-count badge. Badge is
 * hidden at zero, capped display at 99+; refreshes on a 30s poll and on
 * window focus via the unread-count query.
 */
export function NotificationBell() {
  const router = useRouter()
  const unreadQuery = useUnreadNotificationCount()
  const count = unreadQuery.data?.count ?? 0

  return (
    <button
      type="button"
      aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
      onClick={() => router.history.push('/notifications')}
      className={cn(
        'relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors min-h-10',
        'hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <HugeiconsIcon icon={NotificationIcon} size={20} strokeWidth={1.5} aria-hidden="true" />
      {count > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white tabular-nums">
          {count > 99 ? '99+' : count}
          <span className="sr-only">unread notifications</span>
        </span>
      ) : null}
    </button>
  )
}
