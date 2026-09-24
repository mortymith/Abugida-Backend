import { formatCompactCurrency } from '#/lib/format'
import type { RevenueByCourseRow } from '../dashboard.types'

/**
 * Revenue by Course (S-1.2): horizontal ranking bars, matching the spec
 * wireframe (label + bar + amount). A CSS bar list is more faithful — and
 * lighter — than an axis chart for a five-row ranking, and remains
 * keyboard/screen-reader accessible.
 */
export function RevenueByCourseChart({ rows }: { rows: RevenueByCourseRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No revenue recorded for the selected period.
      </p>
    )
  }

  const max = Math.max(...rows.map((row) => row.amount), 1)

  return (
    <ol className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.courseId} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{row.title}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatCompactCurrency(row.amount)}
            </span>
          </div>
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={Math.round(max)}
            aria-valuenow={Math.round(row.amount)}
            aria-label={`Revenue for ${row.title}`}
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-chart-2"
              style={{ width: `${Math.max((row.amount / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}
