import { useMemo } from 'react'
import { Chart } from '@tanstack/react-charts'
import { barY, defineChart } from '@tanstack/charts'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { tooltip } from '@tanstack/charts/tooltip'
import { weekdayLabel } from '../analytics.metric-math'
import type { WeekdayActivityPoint } from '../analytics.types'

interface AnalyticsWeekdayChartProps {
  days: WeekdayActivityPoint[]
  ariaLabel: string
  colorVar?: string
}

/**
 * S-5.1 Student Activity bar chart (by day of week). Uses the shared
 * TanStack Charts setup from TrendChart but with categorical weekday labels
 * instead of parsed dates.
 */
export function AnalyticsWeekdayChart({
  days,
  ariaLabel,
  colorVar = 'var(--chart-2)',
}: AnalyticsWeekdayChartProps) {
  const data = useMemo(
    () =>
      days.map((day) => ({
        label: weekdayLabel(day.weekday),
        value: day.students,
      })),
    [days],
  )

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          barY(data, {
            x: 'label',
            y: 'value',
            fill: colorVar,
            inset: 2,
          }),
        ],
        scales: {
          x: { scale: () => scaleBand<string>().padding(0.2) },
          y: { scale: scaleLinear, nice: true, grid: true, zero: true },
        },
        tooltip,
      }),
    [data, colorVar],
  )

  return (
    <div className="w-full">
      <Chart definition={definition} height={280} ariaLabel={ariaLabel} />
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Students</th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.label}>
              <td>{datum.label}</td>
              <td>{datum.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
