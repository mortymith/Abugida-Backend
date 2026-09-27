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
import { MarketingStatusBadge } from './marketing.status-badge'
import { CampaignComposeDialog } from './marketing.campaign-compose-dialog'
import { CampaignDetailSheet } from './marketing.campaign-detail-sheet'
import type { CampaignsQueryInput } from '../schemas/marketing.schema'

/**
 * S-8.1 Email Campaigns: campaign list with audience, status, sent, open and
 * click columns; a detail sheet with the delivered → opened → clicked →
 * enrolled funnel and link-level clicks; compose with segment builder,
 * scheduling, and the S-7.1 large-send confirmation.
 */
export function CampaignsView({
  query,
  prefillCohort,
}: {
  query: CampaignsQueryInput
  prefillCohort?: string
}) {
  const role = useRole()
  const canWrite = role === 'admin' || role === 'editor'

  const campaignsQuery = useQuery(campaignsQueryOptions(query.status))
  const [composeOpen, setComposeOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const items = campaignsQuery.data?.items ?? []
  const isEmpty = !campaignsQuery.isLoading && items.length === 0 && query.status === 'all'

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Email Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Plan, send, and measure announcement, reminder, and promotion emails to student
            segments.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setComposeOpen(true)}>
            <PlusIcon aria-hidden /> New Campaign
          </Button>
        )}
      </div>

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
          title="No campaigns yet"
          description="Create your first campaign to reach a student segment with a template."
          action={
            canWrite ? (
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
                    <RateCell rate={campaign.openRate} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <RateCell rate={campaign.clickRate} />
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
 */
function RateCell({ rate }: { rate: number | null }) {
  if (rate == null) return <Skeleton className="ml-auto h-4 w-10" aria-label="Metrics updating" />
  return formatPercent(rate)
}
