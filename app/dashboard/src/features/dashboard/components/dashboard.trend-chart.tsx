import { useMemo } from 'react'
import { Chart } from '@tanstack/react-charts'
import { barY, defineChart, lineY } from '@tanstack/charts'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'
import { tooltip } from '@tanstack/charts/tooltip'
import { formatTrendBucket } from '../schemas/dashboard.date-range.schema'
import type { TrendGranularity } from '../schemas/dashboard.date-range.schema'
import type { TrendPoint } from '../dashboard.types'

interface TrendChartProps {
  points: TrendPoint[]
  granularity: TrendGranularity
  kind: 'line' | 'bar'
  ariaLabel: string
  colorVar?: string
}

interface ChartDatum {
  label: string
  value: number
}

/**
 * Trend chart (S-1.1): Revenue Trend (line) and Enrollments (bar), built on
 * TanStack Charts' mark-based API. Definitions are memoized against the full
 * data input per the framework adapter contract.
 */
export function TrendChart({
  points,
  granularity,
  kind,
  ariaLabel,
  colorVar = 'var(--chart-1)',
}: TrendChartProps) {
  const data: ChartDatum[] = useMemo(
    () =>
      points.map((point) => ({
        label: formatTrendBucket(point.date, granularity),
        value: Math.round(point.value * 100) / 100,
      })),
    [points, granularity],
  )

  const definition = useMemo(() => {
    if (kind === 'line') {
      return defineChart({
        marks: [
          lineY(data, {
            x: 'label',
            y: 'value',
            points: true,
            stroke: colorVar,
          }),
        ],
        scales: {
          x: { scale: () => scalePoint<string>().padding(0.25) },
          y: { scale: scaleLinear, nice: true, grid: true, zero: true },
        },
        tooltip,
      })
    }

    return defineChart({
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
    })
  }, [data, kind, colorVar])

  return (
    <div className="w-full">
      <Chart definition={definition} height={280} ariaLabel={ariaLabel} />
      {/* Accessible alternative: every chart exposes its underlying data as a
          table (spec 11 screen-reader support). */}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Value</th>
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
