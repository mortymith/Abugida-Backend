import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon } from '@hugeicons/core-free-icons'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Skeleton } from '#/components/ui/skeleton'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { billingQueryOptions } from '../hooks/settings.queries'

/**
 * S-6.6 Billing & Subscription. Usage bars are computed from real platform
 * data (students, active seats). The plan row, invoices, and payment method
 * have no data source in this platform — the workspace's own subscription is
 * administered by an external billing provider — so those sections render an
 * explicit "no billing provider connected" state instead of fake rows.
 */

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const ratio = limit != null && limit > 0 ? Math.min(1, used / limit) : null
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm tabular-nums">
          {used.toLocaleString()}
          {limit != null ? ` / ${limit.toLocaleString()}` : ''}
        </span>
      </div>
      {ratio != null ? (
        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
          <div
            className={
              ratio >= 0.9 ? 'h-full rounded-full bg-destructive' : 'h-full rounded-full bg-primary'
            }
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">No plan limit configured.</p>
      )}
    </div>
  )
}

export function BillingView() {
  const query = useQuery(billingQueryOptions())

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Billing & Subscription</h1>
        <p className="text-muted-foreground text-sm">
          Manage this workspace's own subscription plan, usage, and invoices.
        </p>
      </header>

      {query.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : query.isError ? (
        <RetryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
      ) : (
        <>
          {query.data.approachingLimit ? (
            <div
              role="status"
              className="flex items-center gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-sm text-orange-700 dark:text-orange-400"
            >
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4" />
              You're close to your plan limit.
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-muted-foreground text-sm">
                No billing provider is connected to this deployment, so plan details, invoices, and
                payment methods are managed outside this workspace. Connect a payment or billing
                provider under Integrations to activate this section.
              </p>
              <div className="grid gap-6 sm:grid-cols-2">
                <UsageBar
                  label="Students"
                  used={query.data.usage.students.used}
                  limit={query.data.usage.students.limit}
                />
                <UsageBar
                  label="Course seats (active enrollments)"
                  used={query.data.usage.seats.used}
                  limit={query.data.usage.seats.limit}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                variant="compact"
                title="No payment method on file"
                description="A billing provider must be connected before payment methods can be managed."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                variant="compact"
                title="No invoices yet"
                description="Invoices appear once a subscription is active through a billing provider."
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
