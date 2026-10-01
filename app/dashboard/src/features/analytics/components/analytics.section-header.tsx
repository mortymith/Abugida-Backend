import { Link } from '@tanstack/react-router'
import { ArrowLeft02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '#/components/ui/button'
import { PageHeader } from '#/components/common/page-header'
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
 *
 * A **thin adapter** over `PageHeader`, not a second header: it keeps the
 * analytics-only affordances (course-scoped back link, date range) while the
 * title, spacing and heading level come from the one primitive every other
 * module uses. Previously this rendered its own `text-xl font-semibold` title,
 * which is why Analytics did not match the rest of the product.
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
        {backTo ? (
          <Button variant="ghost" size="icon-sm" render={<Link to={backTo} params={backParams} />}>
            <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4" />
            <span className="sr-only">{backLabel}</span>
          </Button>
        ) : null}
        <PageHeader
          className="min-w-0 flex-1 pb-0"
          title={title}
          description={subtitle}
          actions={
            (selection && onRangeChange) || actions ? (
              <>
                {selection && onRangeChange ? (
                  <DateRangePicker
                    selection={selection}
                    onChange={onRangeChange}
                    label={rangeLabel ?? 'Date range'}
                  />
                ) : null}
                {actions}
              </>
            ) : undefined
          }
        />
      </div>
    </div>
  )
}
