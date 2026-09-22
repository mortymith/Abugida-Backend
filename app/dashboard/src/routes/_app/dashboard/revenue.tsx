import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { requireRolesBeforeLoad, REVENUE_ROLES } from '#/features/auth'
import { DateRangePicker } from '#/features/dashboard/components/dashboard.date-range-picker'
import type { DateRangeSelection } from '#/features/dashboard/components/dashboard.date-range-picker'
import { RevenueSummaryCards } from '#/features/dashboard/components/revenue.summary-cards'
import { RevenueByCourseChart } from '#/features/dashboard/components/revenue.by-course-chart'
import { RevenueSplitDonut } from '#/features/dashboard/components/revenue.split-donut'
import { RevenueGatewayTable } from '#/features/dashboard/components/revenue.gateway-table'
import { revenueQueryOptions } from '#/features/dashboard/dashboard.queries'
import { buildCsv, downloadCsv } from '#/features/dashboard/dashboard.export-csv'
import { toast } from '#/components/common/toast'

const revenueSearchSchema = z.object({
  preset: z.enum(['7d', '30d', '90d', '12mo']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  gateway: z.string().optional(),
})

export const Route = createFileRoute('/_app/dashboard/revenue')({
  validateSearch: revenueSearchSchema,
  // Hard gate: spec 11 grants revenue to Admin + Editor only.
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
 * S-1.2 Revenue Analytics: summary cards, revenue-by-course ranking,
 * one-time vs subscription split, gateway table. Gateway filter re-queries
 * via the `gateway` search param.
 */
function RevenueAnalyticsPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const rangeInput = { preset: search.preset, from: search.from, to: search.to }
  const revenueQuery = useQuery(revenueQueryOptions(rangeInput))

  function applyRangeChange(next: DateRangeSelection) {
    navigate({
      search: (prev) => ({ ...prev, gateway: undefined, ...next }),
    })
  }

  const gatewayRows = revenueQuery.data?.byGateway ?? []
  const selectedGateway = gatewayRows.find((row) => row.gatewayId === search.gateway) ?? null
  const visibleGatewayRows = selectedGateway ? [selectedGateway] : gatewayRows

  function handleExport() {
    const data = revenueQuery.data
    if (!data) return
    const csv = buildCsv(data.byGateway, [
      { header: 'Payment Gateway', value: (row) => row.displayName },
      { header: 'Transactions', value: (row) => row.transactions },
      { header: 'Amount', value: (row) => row.amount },
    ])
    downloadCsv(`abugida-revenue-${new Date().toISOString().slice(0, 10)}.csv`, csv)
    toast.success('Revenue exported as CSV.')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <DateRangePicker
          selection={rangeInput}
          onChange={applyRangeChange}
          label={revenueQuery.data?.range.label ?? 'Date range'}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={!revenueQuery.data || revenueQuery.data.isEmpty}
        >
          Export
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled
          title="Coming with Export Reports (S-5.4, Analytics module)"
        >
          PDF Report
        </Button>
      </div>

      {revenueQuery.isLoading ? (
        <RevenueSkeleton />
      ) : revenueQuery.isError ? (
        <RetryErrorState
          title="Unable to load revenue data. Retry?"
          onRetry={() => revenueQuery.refetch()}
        />
      ) : revenueQuery.data?.isEmpty ? (
        <EmptyState
          title="No revenue data available."
          description="Completed purchases for the selected period will appear here."
        />
      ) : revenueQuery.data ? (
        <>
          <RevenueSummaryCards summary={revenueQuery.data.summary} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="gap-3 py-5">
              <CardHeader className="px-5">
                <CardTitle className="text-base font-semibold">Revenue by Course</CardTitle>
              </CardHeader>
              <CardContent className="px-5">
                <RevenueByCourseChart rows={revenueQuery.data.byCourse} />
              </CardContent>
            </Card>

            <Card className="gap-3 py-5">
              <CardHeader className="px-5">
                <CardTitle className="text-base font-semibold">Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="px-5">
                <RevenueSplitDonut
                  oneTimePct={revenueQuery.data.split.oneTimePct}
                  subscriptionPct={revenueQuery.data.split.subscriptionPct}
                  note={revenueQuery.data.split.note}
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
                  <DropdownMenuLabel>Payment gateway</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() =>
                      navigate({ search: (prev) => ({ ...prev, gateway: undefined }) })
                    }
                  >
                    All gateways
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {gatewayRows.map((row) => (
                    <DropdownMenuItem
                      key={row.gatewayId}
                      onClick={() =>
                        navigate({ search: (prev) => ({ ...prev, gateway: row.gatewayId }) })
                      }
                      className={search.gateway === row.gatewayId ? 'bg-accent' : undefined}
                    >
                      {row.displayName}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="px-6">
              <RevenueGatewayTable rows={visibleGatewayRows} />
            </CardContent>
          </Card>
        </>
      ) : null}
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
