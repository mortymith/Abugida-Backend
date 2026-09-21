import { StatCard } from './dashboard.stat-card'
import type { KpiMetric } from '../dashboard.types'

/**
 * Revenue summary cards (S-1.2): Total / One-Time / Subscription / Refund
 * with YoY-style deltas. Unsupported metrics render honestly (plan §9-R2).
 */
export function RevenueSummaryCards({ summary }: { summary: KpiMetric[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {summary.map((metric) => (
        <StatCard key={metric.id} metric={metric} />
      ))}
    </div>
  )
}
