import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PlusIcon, RocketIcon } from 'lucide-react'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { formatInteger, formatPercent } from '#/lib/format'
import { useRole } from '#/features/auth'
import { campaignsQueryOptions } from '../hooks/marketing.queries'
import { isMetricsUpdating } from '../marketing.campaign-states'
import { MarketingStatusBadge } from './marketing.status-badge'
import { CampaignComposeDialog } from './marketing.campaign-compose-dialog'
import { CampaignDetailSheet } from './marketing.campaign-detail-sheet'
import type { CampaignsQueryInput } from '../schemas/marketing.schema'
import { PageHeader } from '#/components/common/page-header'

const CAMPAIGN_STATUS_FILTERS: Array<{ value: CampaignsQueryInput['status']; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sending', label: 'Sending' },
  { value: 'sent', label: 'Sent' },
  { value: 'cancelled', label: 'Cancelled' },
]

/**
 * S-8.1 Email Campaigns: campaign list with audience, status, sent, open and
 * click columns; a detail sheet with the delivered → opened → clicked →
 * enrolled funnel and link-level clicks; compose with segment builder,
 * scheduling, and the S-7.1 large-send confirmation.
 */
export function CampaignsView({
  query,
  prefillCohort,
  onQueryChange,
}: {
  query: CampaignsQueryInput
  prefillCohort?: string
  onQueryChange?: (query: CampaignsQueryInput) => void
}) {
  const role = useRole()
  const canWrite = role === 'admin' || role === 'editor'

  const campaignsQuery = useQuery(campaignsQueryOptions(query.status))
  const [composeOpen, setComposeOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const items = campaignsQuery.data?.items ?? []
  const isEmpty = !campaignsQuery.isLoading && items.length === 0

  return (
    <div>
      <PageHeader
        title="Email Campaigns"
        description="Plan, send, and measure announcement, reminder, and promotion emails to student segments."
        actions={
          <>
            {' '}
            <div className="flex flex-wrap items-center gap-2">
              {onQueryChange ? (
                <select
                  aria-label="Status filter"
                  className="border-input bg-background flex h-9 w-44 rounded-md border px-3 text-sm"
                  value={query.status}
                  onChange={(event) =>
                    onQueryChange({
                      ...query,
                      status: event.target.value as CampaignsQueryInput['status'],
                    })
                  }
                >
                  {CAMPAIGN_STATUS_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : null}
              {canWrite && (
                <Button onClick={() => setComposeOpen(true)}>
                  <PlusIcon aria-hidden /> New Campaign
                </Button>
              )}
            </div>
          </>
        }
      />

      {campaignsQuery.isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading campaigns">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : campaignsQuery.isError ? (
        <RetryErrorState onRetry={() => void campaignsQuery.refetch()} />
      ) : isEmpty ? (
        <EmptyState
          icon={<RocketIcon className="size-10 text-muted-foreground" aria-hidden />}
          title={query.status === 'all' ? 'No campaigns yet' : `No ${query.status} campaigns`}
          description={
            query.status === 'all'
              ? 'Create your first campaign to reach a student segment with a template.'
              : 'Try a different status filter to see the rest of your campaigns.'
          }
          action={
            canWrite && query.status === 'all' ? (
              <Button onClick={() => setComposeOpen(true)}>
                <PlusIcon aria-hidden /> New Campaign
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">Click</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((campaign) => (
                <TableRow
                  key={campaign.publicId}
                  onClick={() => setDetailId(campaign.publicId)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">
                    {campaign.name}
                    <div className="text-xs font-normal text-muted-foreground">
                      {campaign.subject}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {campaign.audienceLabel}
                  </TableCell>
                  <TableCell>
                    <MarketingStatusBadge domain="campaign" status={campaign.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.status === 'sent' || campaign.recipientCount != null
                      ? formatInteger(campaign.recipientCount)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <RateCell rate={campaign.openRate} sentAt={campaign.sentAt} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <RateCell rate={campaign.clickRate} sentAt={campaign.sentAt} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CampaignComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        prefillCohort={prefillCohort}
      />
      <CampaignDetailSheet
        campaignPublicId={detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
      />
    </div>
  )
}

/**
 * Open/click cells render the spec's "metrics updating" shimmer while the
 * first-hour window runs (S-8.1 metrics-lag state), then the real rate.
 * A campaign that was never sent has no metrics at all — that is a dash, not
 * a permanent shimmer.
 */
function RateCell({ rate, sentAt }: { rate: number | null; sentAt: string | null }) {
  if (rate != null) return formatPercent(rate)
  if (isMetricsUpdating(sentAt)) {
    return <Skeleton className="ml-auto h-4 w-10" aria-label="Metrics updating" />
  }
  return <span className="text-muted-foreground">—</span>
}
