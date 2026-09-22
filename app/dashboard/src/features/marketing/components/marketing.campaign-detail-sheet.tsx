import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Copy01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { BanIcon } from 'lucide-react'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { Button } from '#/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { Skeleton } from '#/components/ui/skeleton'
import { formatInteger, formatPercent } from '#/lib/format'
import { useRole } from '#/features/auth'
import { campaignDetailQueryOptions } from '../hooks/marketing.queries'
import { useCancelScheduledCampaign, useDuplicateCampaign } from '../hooks/marketing.mutations'
import { MarketingStatusBadge } from './marketing.status-badge'
import type { CampaignFunnel } from '../marketing.types'

/**
 * S-8.1 campaign detail (same screen, expands per row): the delivered →
 * opened → clicked → enrolled funnel plus link-level click breakdowns, with
 * duplicate and cancel-scheduled actions.
 */
export function CampaignDetailSheet({
  campaignPublicId,
  onOpenChange,
}: {
  campaignPublicId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const role = useRole()
  const canWrite = role === 'admin' || role === 'editor'

  const detailQuery = useQuery(campaignDetailQueryOptions(campaignPublicId ?? '__none__'))
  const duplicate = useDuplicateCampaign()
  const cancel = useCancelScheduledCampaign()
  const [cancelOpen, setCancelOpen] = useState(false)

  const detail = campaignPublicId ? detailQuery.data : undefined

  return (
    <Sheet open={campaignPublicId != null} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {detail ? detail.name : 'Campaign'}
            {detail ? <MarketingStatusBadge domain="campaign" status={detail.status} /> : null}
          </SheetTitle>
          <SheetDescription>
            {detail ? `${detail.audienceLabel} · ${detail.subject}` : 'Loading campaign…'}
          </SheetDescription>
        </SheetHeader>

        {detailQuery.isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : detailQuery.isError ? (
          <RetryErrorState onRetry={() => void detailQuery.refetch()} />
        ) : detail ? (
          <div className="mt-4 space-y-6">
            <section aria-label="Campaign funnel">
              <h3 className="mb-2 text-sm font-semibold">Funnel</h3>
              <FunnelBars funnel={detail.funnel} />
            </section>

            <section aria-label="Link clicks">
              <h3 className="mb-2 text-sm font-semibold">Link clicks</h3>
              {detail.linkClicks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No link clicks recorded yet.</p>
              ) : (
                <ul className="space-y-1">
                  {detail.linkClicks.map((link) => (
                    <li
                      key={link.url}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="truncate">{link.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatInteger(link.clicks)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {canWrite &&
            (detail.status === 'scheduled' ||
              detail.status === 'sent' ||
              detail.status === 'cancelled' ||
              detail.status === 'draft') ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={async () => {
                    await duplicate.mutateAsync({ campaignPublicId: detail.publicId })
                    onOpenChange(false)
                  }}
                  disabled={duplicate.isPending}
                >
                  <HugeiconsIcon icon={Copy01Icon} size={16} aria-hidden /> Duplicate
                </Button>
                {detail.status === 'scheduled' ? (
                  <Button
                    variant="destructive"
                    onClick={() => setCancelOpen(true)}
                    disabled={cancel.isPending}
                  >
                    <BanIcon aria-hidden /> Cancel scheduled send
                  </Button>
                ) : null}
              </div>
            ) : null}

            {detail.templateName ? (
              <p className="text-xs text-muted-foreground">Template: {detail.templateName}</p>
            ) : null}
          </div>
        ) : null}
      </SheetContent>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this scheduled send?"
        body="Recipients will not receive the campaign. This cannot be undone once cancelled."
        confirmLabel="Cancel send"
        onConfirm={async () => {
          if (campaignPublicId) await cancel.mutateAsync({ campaignPublicId })
          onOpenChange(false)
        }}
      />
    </Sheet>
  )
}

const FUNNEL_STEPS: Array<{
  key: 'delivered' | 'opened' | 'clicked' | 'enrollments'
  label: string
}> = [
  { key: 'delivered', label: 'Delivered' },
  { key: 'opened', label: 'Opened' },
  { key: 'clicked', label: 'Clicked' },
  { key: 'enrollments', label: 'Enrollments' },
]

function FunnelBars({ funnel }: { funnel: CampaignFunnel }) {
  const max = Math.max(funnel.recipients, 1)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
        <span>Recipients</span>
        <span className="font-medium tabular-nums">{formatInteger(funnel.recipients)}</span>
      </div>
      {FUNNEL_STEPS.map((step) => {
        const value = funnel[step.key]
        if (value == null) {
          return (
            <div
              key={step.key}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <span>{step.label}</span>
              <Skeleton className="h-4 w-12" aria-label="Metrics updating" />
            </div>
          )
        }
        const pct = funnel.recipients > 0 ? Math.round((value / funnel.recipients) * 100) : 0
        return (
          <div
            key={step.key}
            className="rounded-md border px-3 py-2 text-sm"
            aria-label={`${step.label}: ${formatInteger(value)} (${formatPercent(pct)})`}
          >
            <div className="flex items-center justify-between">
              <span>{step.label}</span>
              <span className="font-medium tabular-nums">
                {formatInteger(value)}{' '}
                <span className="text-muted-foreground">({formatPercent(pct)})</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-primary/20" role="presentation">
              <div
                className="h-1.5 rounded-full bg-primary"
                style={{ width: `${Math.max(Math.round((value / max) * 100), 2)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
