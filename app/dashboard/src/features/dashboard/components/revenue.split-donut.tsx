import { formatPercent } from '#/lib/format'

interface RevenueSplitDonutProps {
  oneTimePct: number | null
  subscriptionPct: number | null
  note?: string
}

const RADIUS = 52
const STROKE = 16
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Revenue breakdown donut (S-1.2). Today every purchase is one-time, so the
 * ring renders a single segment; when subscriptions launch the two segments
 * split automatically from the percentages. Status is paired with a legend
 * (never color-only, spec 11).
 */
export function RevenueSplitDonut({ oneTimePct, subscriptionPct, note }: RevenueSplitDonutProps) {
  const hasData = oneTimePct != null && oneTimePct > 0

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        viewBox="0 0 140 140"
        role="img"
        aria-label={`Revenue split: one-time ${formatPercent(oneTimePct)}, subscription ${formatPercent(subscriptionPct)}`}
        className="size-40 -rotate-90"
      >
        <circle
          cx="70"
          cy="70"
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-muted"
        />
        {hasData ? (
          <circle
            cx="70"
            cy="70"
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="butt"
            className="stroke-chart-1"
            strokeDasharray={`${(oneTimePct / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          />
        ) : null}
      </svg>
      <dl className="grid w-full max-w-56 grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-chart-1" />
          <dt>One-Time</dt>
          <dd className="ml-auto font-medium tabular-nums">{formatPercent(oneTimePct)}</dd>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span aria-hidden="true" className="size-2.5 rounded-full border border-dashed" />
          <dt>Subscription</dt>
          <dd className="ml-auto font-medium tabular-nums">{formatPercent(subscriptionPct)}</dd>
        </div>
      </dl>
      {note ? <p className="max-w-64 text-center text-xs text-muted-foreground">{note}</p> : null}
    </div>
  )
}
