import { Link } from '@tanstack/react-router'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { EmptyState } from '#/components/common/empty-state'
import type { CohortComparison, CohortComparisonColumn } from '../analytics.types'

interface AnalyticsCohortCompareProps {
  comparison: CohortComparison
  /** All cohorts for the "+ Add" picker (excludes selected ones). */
  available: Array<{ publicId: string; name: string }>
  onRemove: (cohortId: string) => void
  onAdd: (cohortId: string) => void
}

function formatMetric(metric: CohortComparison['rows'][number], value: number | null): string {
  if (value == null) return '—'
  if (metric.metric === 'timeToFinish') return `${value.toFixed(1)} weeks`
  return `${value}%`
}

/**
 * S-5.5 Cohort Comparison: cohort chips (remove / add), side-by-side metric
 * table with per-column improvement arrows vs the previous column.
 */
export function AnalyticsCohortCompare({
  comparison,
  available,
  onRemove,
  onAdd,
}: AnalyticsCohortCompareProps) {
  if (comparison.columns.length < 2) {
    return (
      <EmptyState
        title="Create at least two cohorts to compare."
        description="Cohorts are managed in Students → Cohorts."
        action={<Button render={<Link to="/students/cohorts" />}>Open Cohort Management</Button>}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {comparison.columns.map((column) => (
          <CohortChip key={column.cohortId} column={column} onRemove={onRemove} />
        ))}
        {available.length > 0 && comparison.columns.length < 4 ? (
          <select
            aria-label="Add cohort to comparison"
            className="h-8 rounded-md border bg-background px-2 text-sm"
            value=""
            onChange={(event) => {
              if (event.target.value) onAdd(event.target.value)
            }}
          >
            <option value="">+ Add cohort…</option>
            {available.map((cohort) => (
              <option key={cohort.publicId} value={cohort.publicId}>
                {cohort.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metric</TableHead>
            {comparison.columns.map((column) => (
              <TableHead key={column.cohortId} className="text-right">
                {column.name}
                <div className="text-xs font-normal text-muted-foreground">
                  {column.memberCount} members
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {comparison.rows.map((row) => (
            <TableRow key={row.metric}>
              <TableCell className="font-medium">{row.label}</TableCell>
              {row.values.map((value, index) => (
                <TableCell key={index} className="text-right tabular-nums">
                  <span className="inline-flex items-center justify-end gap-1">
                    {formatMetric(row, value)}
                    {row.arrows[index] === true ? (
                      <span aria-label="Improved vs previous cohort" className="text-emerald-600">
                        ▲
                      </span>
                    ) : row.arrows[index] === false ? (
                      <span aria-label="Declined vs previous cohort" className="text-destructive">
                        ▼
                      </span>
                    ) : null}
                  </span>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CohortChip({
  column,
  onRemove,
}: {
  column: CohortComparisonColumn
  onRemove: (cohortId: string) => void
}) {
  return (
    <Badge variant="secondary" className="gap-1 py-1 pr-1">
      {column.name}
      <button
        type="button"
        aria-label={`Remove ${column.name} from comparison`}
        onClick={() => onRemove(column.cohortId)}
        className="inline-flex size-4 items-center justify-center rounded-full hover:bg-background/60"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
      </button>
    </Badge>
  )
}
