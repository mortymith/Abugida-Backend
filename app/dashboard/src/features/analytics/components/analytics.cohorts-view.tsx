import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { cohortComparisonQueryOptions } from '../hooks/analytics.queries'
import { cohortsQueryOptions } from '#/features/students'
import { AnalyticsCohortCompare } from './analytics.cohort-compare'
import { AnalyticsExportModal } from './analytics.export-modal'
import type { CohortComparisonColumn } from '../analytics.types'

interface AnalyticsCohortsViewProps {
  /** Cohort public IDs from the URL (shareable); empty = two most recent. */
  cohortIds: string[]
}

/**
 * S-5.5 Cohort Comparison Report: side-by-side cohorts on avg completion,
 * avg quiz score, and avg time-to-finish, with improvement arrows. Selection
 * lives in the URL for shareability.
 */
export function AnalyticsCohortsView({ cohortIds }: AnalyticsCohortsViewProps) {
  const [exportOpen, setExportOpen] = useState(false)
  const navigate = useNavigate()
  const comparisonQuery = useQuery(cohortComparisonQueryOptions(cohortIds))
  // Picker options: every cohort (query returns up to 200, most recent first).
  const allCohortsQuery = useQuery({ ...cohortsQueryOptions({}), enabled: true })

  function updateSelection(next: string[]) {
    navigate({
      to: '/analytics/cohorts',
      search: next.length > 0 ? { cohorts: next.join(',') } : {},
    })
  }

  const comparison = comparisonQuery.data
  const selected = new Set<string>(
    comparison?.columns.map((column: CohortComparisonColumn) => column.cohortId) ?? cohortIds,
  )
  const available = (allCohortsQuery.data?.items ?? [])
    .filter((cohort) => !selected.has(cohort.publicId))
    .map((cohort) => ({ publicId: cohort.publicId, name: cohort.name }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Cohort Comparison</h1>
          <p className="text-sm text-muted-foreground">
            Compare cohorts on completion, quiz scores, and time-to-finish.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExportOpen(true)}
          disabled={!comparison || comparison.isEmpty}
        >
          Export
        </Button>
      </div>

      {comparisonQuery.isError ? (
        <RetryErrorState
          title="Unable to load analytics. Retry?"
          onRetry={() => comparisonQuery.refetch()}
        />
      ) : comparisonQuery.isLoading || !comparison ? (
        <div className="h-64 animate-pulse rounded-md bg-muted/50" aria-hidden="true" />
      ) : (
        <AnalyticsCohortCompare
          comparison={comparison}
          available={available}
          onRemove={(cohortId) => {
            const next = cohortIds.filter((id) => id !== cohortId)
            updateSelection(next)
          }}
          onAdd={(cohortId) => {
            if (cohortIds.length >= 4) return
            updateSelection([...cohortIds, cohortId])
          }}
        />
      )}

      <AnalyticsExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        defaults={{
          reportType: 'cohort-comparison',
          range: {},
          cohortIds: [...selected],
        }}
      />
    </div>
  )
}
