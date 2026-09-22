import { Link } from '@tanstack/react-router'
import { ArrowLeft02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '#/components/ui/button'
import { DateRangePicker } from '#/features/dashboard/components/dashboard.date-range-picker'
import type { DateRangeSelection } from '#/features/dashboard/components/dashboard.date-range-picker'

interface AnalyticsSectionHeaderProps {
  /** Course-scoped screens link back to the course's performance page. */
  backTo?: string
  /** Path params for the back link (e.g. { courseId }). */
  backParams?: Record<string, string>
  backLabel?: string
  title: string
  subtitle?: string
  rangeLabel?: string
  selection?: DateRangeSelection
  onRangeChange?: (next: DateRangeSelection) => void
  /** Extra header actions (Export / PDF Report / custom). */
  actions?: React.ReactNode
}

/**
 * Shared S-5.x screen header: back link, title, date range, actions.
 * Keeps the analytics screens visually consistent with S-1.1/S-1.2.
 */
export function AnalyticsSectionHeader({
  backTo,
  backParams,
  backLabel = 'Back',
  title,
  subtitle,
  rangeLabel,
  selection,
  onRangeChange,
  actions,
}: AnalyticsSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {backTo ? (
            <Button
              variant="ghost"
              size="icon-sm"
              render={<Link to={backTo} params={backParams} />}
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4" />
              <span className="sr-only">{backLabel}</span>
            </Button>
          ) : null}
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {selection && onRangeChange ? (
            <DateRangePicker
              selection={selection}
              onChange={onRangeChange}
              label={rangeLabel ?? 'Date range'}
            />
          ) : null}
          {actions}
        </div>
      </div>
    </div>
  )
}
