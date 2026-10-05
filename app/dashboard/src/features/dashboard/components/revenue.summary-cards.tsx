import { StatCard } from './dashboard.stat-card'
import type { KpiMetric } from '../dashboard.types'

/**
 * Revenue summary cards (S-1.2): Total / One-Time / Subscription / Refund.
 *
 * Every card carries the same comparison basis the screen states — on this
 * screen the previous **12 months** — and a metric the payment layer cannot
 * produce renders as an explanation rather than a zero (spec 11: never fake a
 * number).
 */
export function RevenueSummaryCards({
  summary,
  comparisonLabel,
  compareEnabled = true,
}: {
  summary: KpiMetric[]
  comparisonLabel?: string
  compareEnabled?: boolean
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {summary.map((metric) => (
        <StatCard
          key={metric.id}
          metric={metric}
          comparisonLabel={comparisonLabel}
          compareEnabled={compareEnabled}
        />
      ))}
    </div>
  )
}
