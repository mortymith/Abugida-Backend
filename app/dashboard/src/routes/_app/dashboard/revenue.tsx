import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { EmptyState } from '#/components/common/empty-state'
import { PageHeader } from '#/components/common/page-header'
import { RetryErrorState, readRequestId } from '#/components/common/retry-error-state'
import { requireRolesBeforeLoad } from '#/features/auth/server'
import { hasAtLeastRole, REVENUE_ROLES, useRole } from '#/features/auth'
import { DateRangePicker } from '#/features/dashboard/components/dashboard.date-range-picker'
import type { DateRangeSelection } from '#/features/dashboard/components/dashboard.date-range-picker'
import { CompareToggle } from '#/features/dashboard/components/dashboard.compare-toggle'
import { RevenueSummaryCards } from '#/features/dashboard/components/revenue.summary-cards'
import { RevenueByCourseChart } from '#/features/dashboard/components/revenue.by-course-chart'
import { RevenueBreakdownDonut } from '#/features/dashboard/components/revenue.gateway-breakdown'
import { RevenueGatewayTable } from '#/features/dashboard/components/revenue.gateway-table'
import { revenueQueryOptions } from '#/features/dashboard/dashboard.queries'
import { DATE_RANGE_PRESETS } from '#/features/dashboard/schemas/dashboard.date-range.schema'
import { AnalyticsExportModal } from '#/features/analytics'
import { trackNavEvent } from '#/features/navigation'

const revenueSearchSchema = z.object({
  preset: z.enum(DATE_RANGE_PRESETS).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  compare: z.union([z.literal('true'), z.literal('false')]).optional(),
  gateway: z.string().optional(),
})

export const Route = createFileRoute('/_app/dashboard/revenue')({
  validateSearch: revenueSearchSchema,
  // Hard gate: spec 11 grants revenue to Admin + Editor only. Anyone else is
  // stopped at the route, so the figure is never on the page or in the payload.
  beforeLoad: async () => {
    await requireRolesBeforeLoad(REVENUE_ROLES)
  },
  loaderDeps: ({ search }) => ({
    preset: search.preset,
    from: search.from,
    to: search.to,
  }),
  loader: ({ context, deps }) => {
    // Warm the cache; failures surface through the component query.
    return Promise.allSettled([
      context.queryClient.ensureQueryData(
        revenueQueryOptions({ preset: deps.preset, from: deps.from, to: deps.to }),
      ),
    ])
  },
  component: RevenueAnalyticsPage,
})

/**
 * S-1.2 Revenue Analytics: summary cards, revenue-by-course ranking, the
 * payment-gateway breakdown (≤ 4 slices + Other) and its equivalent table, with
 * a gateway filter that distinguishes "no matches" from "no data".
 */
function RevenueAnalyticsPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const compareEnabled = search.compare !== 'false'
  const rangeInput = { preset: search.preset, from: search.from, to: search.to }
  // S-1.2 navigation: Export opens the shared Export Reports flow (S-5.4); the
  // action is absent for a role that holds no export capability.
  const canExport = hasAtLeastRole(useRole(), 'editor')
  const [exportOpen, setExportOpen] = useState(false)
  const revenueQuery = useQuery(revenueQueryOptions(rangeInput))
  const data = revenueQuery.data

  function applyRangeChange(next: DateRangeSelection) {
    navigate({ search: (prev) => ({ ...prev, gateway: undefined, ...next }) })
  }

  function setGateway(gatewayId: string | undefined) {
    navigate({ search: (prev) => ({ ...prev, gateway: gatewayId }) })
  }

  function setCompare(next: boolean) {
    navigate({ search: (prev) => ({ ...prev, compare: next ? undefined : 'false' }) })
  }

  function clearFilters() {
    navigate({
      search: {
        preset: '30d',
        gateway: undefined,
        compare: search.compare === 'false' ? 'false' : undefined,
      },
    })
  }

  // `revenue_viewed{range,gatewayFilter}` — no amounts, no names.
  useEffect(() => {
    if (!data) return
    trackNavEvent('revenue_viewed', {
      range: data.range.label,
      gatewayFilter: search.gateway ?? 'all',
    })
  }, [data, search.gateway])

  const gatewayRows = data?.byGateway ?? []
  const selectedGateway = gatewayRows.find((row) => row.gatewayId === search.gateway) ?? null
  const visibleGatewayRows = selectedGateway ? [selectedGateway] : gatewayRows
  // A filter that matches nothing is a zero-result state, not an empty dataset.
  const isZeroResult = search.gateway != null && selectedGateway == null && data != null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        level={2}
        eyebrow="Dashboard"
        title="Revenue Analytics"
        description="Revenue by source, course, and payment channel for the selected period."
        actions={
          <>
            <DateRangePicker
              selection={rangeInput}
              onChange={applyRangeChange}
              label={data?.range.label ?? 'Date range'}
            />
            <CompareToggle enabled={compareEnabled} onToggle={setCompare} />
            {canExport ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  trackNavEvent('revenue_export_clicked', { range: data?.range.label ?? '' })
                  setExportOpen(true)
                }}
              >
                Export
              </Button>
            ) : null}
          </>
        }
      >
        {data?.range.partialDayNote ? (
          <p className="text-xs text-muted-foreground">{data.range.partialDayNote}</p>
        ) : null}
      </PageHeader>

      {revenueQuery.isLoading ? (
        <RevenueSkeleton />
      ) : revenueQuery.isError ? (
        <RetryErrorState
          title="We couldn't load revenue data — nothing has changed."
          onRetry={() => void revenueQuery.refetch()}
          isRetrying={revenueQuery.isFetching}
          requestId={readRequestId(revenueQuery.error)}
        />
      ) : data && !data.hasHistory ? (
        <EmptyState
          title="No revenue recorded yet."
          description="This workspace has never taken a payment."
        />
      ) : data?.isEmpty ? (
        <EmptyState
          title="No data for the selected period — adjust the date range."
          description="Nothing was recorded in these dates."
          action={
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : data ? (
        <>
          <RevenueSummaryCards
            summary={data.summary}
            comparisonLabel={data.range.comparisonLabel}
            compareEnabled={compareEnabled}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="gap-3 py-5">
              <CardHeader className="px-5">
                <CardTitle className="text-base font-semibold">Revenue by Course</CardTitle>
              </CardHeader>
              <CardContent className="px-5">
                <RevenueByCourseChart rows={data.byCourse} />
              </CardContent>
            </Card>

            <Card className="gap-3 py-5">
              <CardHeader className="px-5">
                <CardTitle className="text-base font-semibold">Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="px-5">
                <RevenueBreakdownDonut
                  slices={data.slices}
                  total={data.slices.reduce((total, slice) => total + slice.amount, 0)}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="gap-4 py-6">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-6">
              <CardTitle className="text-lg font-semibold">
                By Payment Gateway
                {selectedGateway ? (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    filtered: {selectedGateway.displayName}
                  </span>
                ) : null}
              </CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm">
                      Filter gateway
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Payment gateway</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setGateway(undefined)}>
                      All gateways
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {gatewayRows.map((row) => (
                      <DropdownMenuItem
                        key={row.gatewayId}
                        onClick={() => setGateway(row.gatewayId)}
                        className={search.gateway === row.gatewayId ? 'bg-accent' : undefined}
                      >
                        {row.displayName}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="px-6">
              {isZeroResult ? (
                <EmptyState
                  variant="compact"
                  level={3}
                  title="No matches — adjust filters."
                  description="That gateway recorded no transactions in the selected period."
                  action={
                    <Button variant="outline" size="sm" onClick={() => setGateway(undefined)}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <RevenueGatewayTable rows={visibleGatewayRows} />
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <AnalyticsExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        defaults={{ reportType: 'revenue', range: rangeInput }}
      />
    </div>
  )
}

function RevenueSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  )
}
