import { formatCompactCurrency, formatInteger } from '#/lib/format'
import type { RevenueSlice } from '../dashboard.types'

const RADIUS = 52
const STROKE = 16
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Slice colours come from the chart tokens, so light and dark stay in step. */
const SLICE_VARS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

interface RevenueBreakdownDonutProps {
  /** Already folded server-side to at most 4 slices + "Other". */
  slices: RevenueSlice[]
  total: number
}

/**
 * Revenue breakdown (S-1.2) — a donut plus a legend that carries the numbers.
 *
 * The legend is not decoration: the equivalent table (S-1.2 acceptance) is this
 * list, with the currency code on every figure, so the breakdown is readable
 * without reading colour. A fifth category is folded into **Other** by the
 * server, never dropped silently.
 */
export function RevenueBreakdownDonut({ slices, total }: RevenueBreakdownDonutProps) {
  if (slices.length === 0 || total <= 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No payments recorded for the selected period.
      </p>
    )
  }

  let offset = 0

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg
        viewBox="0 0 140 140"
        role="img"
        aria-label={`Revenue split across ${slices.length} payment ${
          slices.length === 1 ? 'channel' : 'channels'
        }`}
        className="size-40 shrink-0 -rotate-90"
      >
        <circle
          cx="70"
          cy="70"
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-muted"
        />
        {slices.map((slice, index) => {
          const fraction = total > 0 ? Math.max(slice.amount / total, 0.01) : 0
          const length = fraction * CIRCUMFERENCE
          const dash = `${length} ${CIRCUMFERENCE - length}`
          const rotation = offset
          offset += fraction
          return (
            <circle
              key={slice.id}
              cx="70"
              cy="70"
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="butt"
              stroke={SLICE_VARS[index % SLICE_VARS.length]}
              strokeDasharray={dash}
              strokeDashoffset={-rotation * CIRCUMFERENCE}
            />
          )
        })}
      </svg>

      <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
        {slices.map((slice, index) => (
          <li key={slice.id} className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: SLICE_VARS[index % SLICE_VARS.length] }}
              />
              <span className="truncate">{slice.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                ({formatInteger(slice.transactions)})
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{formatCompactCurrency(slice.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
