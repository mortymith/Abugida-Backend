import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { PlusIcon, TicketIcon } from 'lucide-react'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { toast } from '#/components/common/toast'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { formatCurrency, formatInteger } from '#/lib/format'
import { useRole } from '#/features/auth'
import { couponRedemptionsQueryOptions, couponsQueryOptions } from '../hooks/marketing.queries'
import { useUpdateCoupon } from '../hooks/marketing.mutations'
import { buildCouponCsv } from '../marketing.coupon-codes'
import { MarketingStatusBadge } from './marketing.status-badge'
import { CouponGeneratorDialog } from './marketing.coupon-generate-dialog'
import { countRecentRedemptions } from '../server/all'
import type { CouponRow } from '../marketing.types'

/**
 * S-8.3 Discount & Coupon Codes: generate single/multi-use codes with scope,
 * limits, and expiry; batch generation with immediate CSV export; deactivate
 * (with the recent-redemption warning) or extend; per-code revenue influence
 * and redemption history.
 */
export function CouponsView({ status = 'all' }: { status?: string }) {
  const role = useRole()
  const canWrite = role === 'admin' || role === 'editor'

  const couponsQuery = useQuery(couponsQueryOptions(status))
  const [generateOpen, setGenerateOpen] = useState(false)
  const [redemptionsFor, setRedemptionsFor] = useState<CouponRow | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<CouponRow | null>(null)
  const [recentCount, setRecentCount] = useState<number | null>(null)
  const [extendTarget, setExtendTarget] = useState<CouponRow | null>(null)
  const [extendDate, setExtendDate] = useState('')

  const updateCoupon = useUpdateCoupon()

  const items = couponsQuery.data?.items ?? []

  const handleDeactivate = async () => {
    const target = deactivateTarget
    if (!target) return
    await updateCoupon.mutateAsync({ couponPublicId: target.publicId, isActive: false })
  }

  const handleExtend = async () => {
    const target = extendTarget
    if (!target || !extendDate) return
    await updateCoupon.mutateAsync({
      couponPublicId: target.publicId,
      expiresAt: new Date(`${extendDate}T23:59:59`).toISOString(),
    })
    setExtendTarget(null)
    setExtendDate('')
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Discount &amp; Coupon Codes</h1>
          <p className="text-sm text-muted-foreground">
            Single-use or multi-use codes for specific courses, with usage limits, expiry, and
            revenue attribution.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setGenerateOpen(true)}>
            <PlusIcon aria-hidden /> Generate Codes
          </Button>
        )}
      </div>

      {couponsQuery.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : couponsQuery.isError ? (
        <RetryErrorState onRetry={() => void couponsQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<TicketIcon className="size-10 text-muted-foreground" aria-hidden />}
          title="No coupon codes yet"
          description="Generate percentage, fixed-amount, or full-access codes scoped to specific courses."
          action={
            canWrite ? (
              <Button onClick={() => setGenerateOpen(true)}>
                <PlusIcon aria-hidden /> Generate Codes
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="text-right">Usage</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((coupon) => (
                <TableRow key={coupon.publicId}>
                  <TableCell className="font-mono font-medium">{coupon.code}</TableCell>
                  <TableCell>{describeDiscount(coupon)}</TableCell>
                  <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                    {coupon.scope.length === 0
                      ? 'Any course'
                      : coupon.scope.map((course) => course.title).join(', ')}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatInteger(coupon.redemptionCount)} / {coupon.maxRedemptions ?? '∞'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(coupon.revenueInfluenced)}
                  </TableCell>
                  <TableCell>
                    <MarketingStatusBadge domain="coupon" status={coupon.state} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {coupon.expiresAt ? format(new Date(coupon.expiresAt), 'MMM d, yyyy') : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    {canWrite ? (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setRedemptionsFor(coupon)}>
                          Redemptions
                        </Button>
                        {coupon.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={async () => {
                              // Spec: S-7.1 confirmation when the code has
                              // redemptions in the last 24 hours.
                              try {
                                const recent = await countRecentRedemptions({
                                  data: { couponPublicId: coupon.publicId },
                                })
                                setRecentCount(recent.count)
                              } catch {
                                setRecentCount(null)
                              }
                              setDeactivateTarget(coupon)
                            }}
                          >
                            Deactivate
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setExtendTarget(coupon)
                            setExtendDate('')
                          }}
                        >
                          Extend
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CouponGeneratorDialog open={generateOpen} onOpenChange={setGenerateOpen} />

      <Dialog
        open={redemptionsFor != null}
        onOpenChange={(open) => !open && setRedemptionsFor(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Redemptions — {redemptionsFor?.code}</DialogTitle>
            <DialogDescription>
              Revenue influenced: {formatCurrency(redemptionsFor?.revenueInfluenced ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <RedemptionHistory coupon={redemptionsFor} />
        </DialogContent>
      </Dialog>

      {/* S-7.1 deactivation confirmation; recent redemptions raise the stakes. */}
      <ConfirmDialog
        open={deactivateTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateTarget(null)
            setRecentCount(null)
          }
        }}
        title={
          (recentCount ?? 0) > 0
            ? `This code had ${recentCount} redemption(s) in the last 24 hours. Deactivate anyway?`
            : 'Deactivate this code?'
        }
        body="Deactivated codes stop working at checkout immediately but remain visible here for reporting."
        confirmLabel="Deactivate"
        onConfirm={async () => {
          await handleDeactivate()
        }}
      />

      <Dialog open={extendTarget != null} onOpenChange={(open) => !open && setExtendTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Extend {extendTarget?.code}</DialogTitle>
            <DialogDescription>Pick a new expiry date in the future.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="coupon-extend-date">New expiry</Label>
            <Input
              id="coupon-extend-date"
              type="date"
              value={extendDate}
              onChange={(event) => setExtendDate(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleExtend()} disabled={!extendDate}>
              Extend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function describeDiscount(coupon: CouponRow): string {
  if (coupon.kind === 'percentage') return `${formatInteger(coupon.value)}%`
  if (coupon.kind === 'fixed') return `${formatCurrency(coupon.value, coupon.currency)} off`
  return '100% access'
}

function RedemptionHistory({ coupon }: { coupon: CouponRow | null }) {
  const historyQuery = useQuery({
    ...couponRedemptionsQueryOptions(coupon?.publicId ?? '__none__'),
    enabled: coupon != null,
  })

  if (historyQuery.isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    )
  }
  const items = historyQuery.data?.items ?? []
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No redemptions yet.</p>
  }
  return (
    <ul className="max-h-64 space-y-1 overflow-y-auto">
      {items.map((redemption) => (
        <li
          key={redemption.id}
          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
        >
          <span>
            {redemption.studentName}
            {redemption.courseTitle ? (
              <span className="text-muted-foreground"> · {redemption.courseTitle}</span>
            ) : null}
          </span>
          <span className="tabular-nums text-muted-foreground">
            −{formatCurrency(redemption.amountDiscounted, redemption.currency)} ·{' '}
            {format(new Date(redemption.redeemedAt), 'MMM d')}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** CSV export for single-use batches (spec S-8.3). */
export function downloadCouponCsv(codes: string[], expiresAt: string | null) {
  const csv = buildCouponCsv(codes, { expiresAt })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `coupon-batch-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
  toast.success('CSV exported.')
}
