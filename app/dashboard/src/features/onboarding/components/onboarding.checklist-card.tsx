import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight02Icon,
  BookEditIcon,
  CreditCardIcon,
  PaletteIcon,
  Tick02Icon,
  UserAdd01Icon,
} from '@hugeicons/core-free-icons'

import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { getChecklist } from '#/features/onboarding/server/onboarding.checklist'
import type { ChecklistItemId } from '#/features/onboarding/onboarding.checklist'

const ICONS: Record<ChecklistItemId, typeof UserAdd01Icon> = {
  invite_team: UserAdd01Icon,
  brand_workspace: PaletteIcon,
  first_course: BookEditIcon,
  payment_gateway: CreditCardIcon,
}

/**
 * S-0.2 Getting Started Checklist, rendered on S-1.1.
 *
 * The card is **absent** when every applicable item is complete — and because
 * the applicable items themselves are derived from `Primary Use Case`, a
 * workspace that will never charge never sees a payment task at all. Each tick
 * is a real server-side criterion (a member row, a draft course, a configured
 * brand colour, an enabled gateway), not a click counter.
 */
export function ChecklistCard({ className, id }: { className?: string; id?: string }) {
  const query = useQuery({
    queryKey: ['onboarding', 'checklist'],
    queryFn: getChecklist,
    retry: false,
  })

  if (query.isPending) {
    return (
      <Card className={className} aria-busy="true">
        <CardHeader>
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const checklist = query.data
  // Hidden once complete; `Resume setup` is the affordance that replaces it,
  // and it disappears at the same moment.
  if (!checklist || !checklist.showCard) return null

  return (
    <Card className={className} id={id}>
      <CardHeader className="pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="text-base font-semibold">Getting started</CardTitle>
          <p className="text-xs text-muted-foreground">
            {checklist.completed} of {checklist.total} done
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-2">
          {checklist.items.map((item) => {
            const Icon = ICONS[item.id]
            return (
              <li key={item.id}>
                <Link
                  to={item.to}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-3 transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    'hover:bg-accent/40',
                    item.done && 'border-success/30 bg-success/5',
                  )}
                >
                  <div
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-xl',
                      item.done ? 'bg-success-bg text-success-fg' : 'bg-primary/10 text-primary',
                    )}
                  >
                    <HugeiconsIcon
                      icon={item.done ? Tick02Icon : Icon}
                      size={18}
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {item.title}
                      <span className="sr-only">{item.done ? ' — done' : ' — not done yet'}</span>
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  {!item.done ? (
                    <HugeiconsIcon
                      icon={ArrowRight02Icon}
                      size={16}
                      className="mt-2 shrink-0 text-muted-foreground/50"
                      aria-hidden="true"
                    />
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}

/**
 * The single "Resume setup" link the spec uses to replace a dismissed card.
 * Rendered by the dashboard only while there is outstanding setup.
 */
export function ChecklistResumeLink() {
  const query = useQuery({
    queryKey: ['onboarding', 'checklist'],
    queryFn: getChecklist,
    retry: false,
  })

  if (!query.data?.resumeAvailable) return null

  return (
    <a
      href="#getting-started"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      Resume setup
      <HugeiconsIcon icon={ArrowRight02Icon} size={14} aria-hidden="true" />
    </a>
  )
}
