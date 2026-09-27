import { HugeiconsIcon } from '@hugeicons/react'
import {
  CircleIcon,
  ClockIcon,
  Delete02Icon,
  Loading03Icon,
  MailIcon,
  Tick02Icon,
  Tick01Icon,
  CancelIcon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { Badge } from '#/components/ui/badge'
import { cn } from '#/lib/utils'

/**
 * Status pills for the Marketing & Growth screens (spec 10). State is never
 * color-only: every pill pairs an icon with a text label (spec 11).
 */

interface PillEntry {
  label: string
  icon: IconSvgElement
  className: string
}
const CAMPAIGN_CONFIG = {
  draft: { label: 'Draft', icon: CircleIcon, className: 'bg-muted text-foreground' },
  scheduled: { label: 'Scheduled', icon: ClockIcon, className: 'bg-warning/10 text-warning' },
  sending: { label: 'Sending', icon: Loading03Icon, className: 'bg-info/10 text-info' },
  sent: { label: 'Sent', icon: MailIcon, className: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelled', icon: CancelIcon, className: 'bg-muted text-muted-foreground' },
} as const

const COUPON_CONFIG = {
  active: { label: 'Active', icon: Tick02Icon, className: 'bg-success/10 text-success' },
  expired: { label: 'Expired', icon: ClockIcon, className: 'bg-muted text-muted-foreground' },
  deactivated: {
    label: 'Deactivated',
    icon: CancelIcon,
    className: 'bg-muted text-muted-foreground',
  },
  exhausted: { label: 'Exhausted', icon: ClockIcon, className: 'bg-warning/10 text-warning' },
} as const

const AFFILIATE_CONFIG = {
  pending: { label: 'Pending', icon: ClockIcon, className: 'bg-warning/10 text-warning' },
  approved: { label: 'Approved', icon: Tick02Icon, className: 'bg-success/10 text-success' },
  suspended: {
    label: 'Suspended',
    icon: CancelIcon,
    className: 'bg-destructive/10 text-destructive',
  },
  declined: { label: 'Declined', icon: Delete02Icon, className: 'bg-muted text-muted-foreground' },
} as const

const TESTIMONIAL_CONFIG = {
  pending: { label: 'Pending', icon: ClockIcon, className: 'bg-warning/10 text-warning' },
  published: { label: 'Published', icon: Tick02Icon, className: 'bg-success/10 text-success' },
  rejected: {
    label: 'Rejected',
    icon: CancelIcon,
    className: 'bg-destructive/10 text-destructive',
  },
  archived: { label: 'Archived', icon: Delete02Icon, className: 'bg-muted text-muted-foreground' },
} as const

function StatusPill<TStatus extends string>({
  config,
  status,
  className,
}: {
  config: Record<TStatus, PillEntry>
  status: TStatus
  className?: string
}) {
  const entry = config[status]
  return (
    <Badge
      variant="secondary"
      className={cn('gap-1 whitespace-nowrap', entry.className, className)}
    >
      <HugeiconsIcon icon={entry.icon} size={12} strokeWidth={2} aria-hidden="true" />
      {entry.label}
    </Badge>
  )
}

export function MarketingStatusBadge({
  domain,
  status,
  className,
}: {
  domain: 'campaign' | 'coupon' | 'affiliate' | 'testimonial'
  status: string
  className?: string
}) {
  switch (domain) {
    case 'campaign':
      return (
        <StatusPill
          config={CAMPAIGN_CONFIG}
          status={status as keyof typeof CAMPAIGN_CONFIG}
          className={className}
        />
      )
    case 'coupon':
      return (
        <StatusPill
          config={COUPON_CONFIG}
          status={status as keyof typeof COUPON_CONFIG}
          className={className}
        />
      )
    case 'affiliate':
      return (
        <StatusPill
          config={AFFILIATE_CONFIG}
          status={status as keyof typeof AFFILIATE_CONFIG}
          className={className}
        />
      )
    case 'testimonial':
      return (
        <StatusPill
          config={TESTIMONIAL_CONFIG}
          status={status as keyof typeof TESTIMONIAL_CONFIG}
          className={className}
        />
      )
    default:
      return null
  }
}

/** Featured mark with an accessible label (S-8.5 featured items). */
export function FeaturedStar({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-xs font-medium text-warning', className)}
    >
      <HugeiconsIcon icon={Tick01Icon} size={12} strokeWidth={2} aria-hidden="true" />
      <span>Featured</span>
    </span>
  )
}
