import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BanIcon, CheckIcon, PlusIcon, ShieldAlertIcon, XIcon } from 'lucide-react'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
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
import {
  affiliateProgramQueryOptions,
  affiliatesQueryOptions,
  pendingPayoutsQueryOptions,
} from '../hooks/marketing.queries'
import {
  useDecideAffiliate,
  useFlagAffiliateFraud,
  useInviteAffiliate,
  useRunPayouts,
  useSaveProgramSettings,
} from '../hooks/marketing.mutations'
import { MarketingStatusBadge } from './marketing.status-badge'
import type { AffiliateRow } from '../marketing.types'

/**
 * S-8.4 Affiliate Program: program settings (admin) with commission, cookie
 * window, payout threshold/method; application review; per-affiliate
 * clicks/sales/revenue/owed; fraud flags with commission holds; payout runs
 * behind an S-7.1 confirmation with failing rows listed.
 */
export function AffiliatesView({ status = 'all' }: { status?: string }) {
  const role = useRole()
  const canWrite = role === 'admin' || role === 'editor'
  const canPayout = role === 'admin'

  const programQuery = useQuery(affiliateProgramQueryOptions())
  const affiliatesQuery = useQuery(affiliatesQueryOptions(status))

  const program = programQuery.data
  const items = affiliatesQuery.data?.items ?? []
  const pending = items.filter((item) => item.status === 'pending')

  const [inviteOpen, setInviteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [detail, setDetail] = useState<AffiliateRow | null>(null)
  const [payoutConfirmOpen, setPayoutConfirmOpen] = useState(false)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Affiliate Program</h1>
          <p className="text-sm text-muted-foreground">
            Affiliates promote courses and earn commissions on sales — applications, links,
            performance, and payouts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPayout && (
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              Program Settings
            </Button>
          )}
          {canWrite && (
            <Button onClick={() => setInviteOpen(true)}>
              <PlusIcon aria-hidden /> Invite Affiliate
            </Button>
          )}
        </div>
      </div>

      {programQuery.isLoading ? (
        <Skeleton className="mb-4 h-20 w-full" aria-busy="true" />
      ) : program ? (
        <Card className="mb-4">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm">
              Commission{' '}
              <strong className="tabular-nums">{program.settings.commissionPercent}%</strong> ·
              Cookie window{' '}
              <strong className="tabular-nums">{program.settings.cookieWindowDays} days</strong> ·
              Payout at{' '}
              <strong className="tabular-nums">
                {formatCurrency(program.settings.payoutThreshold)}
              </strong>{' '}
              via <strong>{program.settings.payoutMethod.replace(/_/g, ' ')}</strong>
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Pending payouts:{' '}
                <strong className="tabular-nums">
                  {formatCurrency(program.pendingPayoutTotal)}
                </strong>
              </span>
              {canPayout ? (
                <Button size="sm" onClick={() => setPayoutConfirmOpen(true)}>
                  Run Payout
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {pending.length > 0 ? (
        <section aria-label="Pending applications" className="mb-4">
          <h2 className="mb-2 text-sm font-semibold">Applications: {pending.length} pending</h2>
          <div className="space-y-2">
            {pending.map((affiliate) => (
              <ApplicationRow key={affiliate.publicId} affiliate={affiliate} canDecide={canWrite} />
            ))}
          </div>
        </section>
      ) : null}

      {affiliatesQuery.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : affiliatesQuery.isError ? (
        <RetryErrorState onRetry={() => void affiliatesQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ShieldAlertIcon className="size-10 text-muted-foreground" aria-hidden />}
          title="No affiliates yet"
          description="Invite partners to promote your courses and earn commission on attributed sales."
          action={
            canWrite ? (
              <Button onClick={() => setInviteOpen(true)}>
                <PlusIcon aria-hidden /> Invite Affiliate
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Affiliate</TableHead>
                <TableHead>Link/Code</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Owed</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items
                .filter((item) => item.status !== 'pending')
                .map((affiliate) => (
                  <TableRow
                    key={affiliate.publicId}
                    className="cursor-pointer"
                    onClick={() => setDetail(affiliate)}
                  >
                    <TableCell className="font-medium">
                      {affiliate.name}
                      {affiliate.fraudFlaggedAt ? (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-destructive">
                          <ShieldAlertIcon className="size-3" aria-hidden /> Fraud flag
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {affiliate.links.length > 0
                        ? affiliate.links.map((link) => link.code).join(', ')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInteger(affiliate.clicks)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInteger(affiliate.sales)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(affiliate.revenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(affiliate.owed)}
                    </TableCell>
                    <TableCell>
                      <MarketingStatusBadge domain="affiliate" status={affiliate.status} />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}

      <InviteAffiliateDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <ProgramSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AffiliateDetailDialog affiliate={detail} onOpenChange={(open) => !open && setDetail(null)} />

      <PayoutConfirmDialog open={payoutConfirmOpen} onOpenChange={setPayoutConfirmOpen} />
    </div>
  )
}

function ApplicationRow({ affiliate, canDecide }: { affiliate: AffiliateRow; canDecide: boolean }) {
  const decide = useDecideAffiliate()
  const [note, setNote] = useState('')

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
      <div>
        <p className="text-sm font-medium">
          {affiliate.name} <span className="text-muted-foreground">{affiliate.email}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {affiliate.audience ? `Audience: ${affiliate.audience}` : ''}
          {affiliate.channels ? ` · Channels: ${affiliate.channels}` : ''}
        </p>
      </div>
      {canDecide ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional note"
            className="h-8 w-40"
            maxLength={500}
            aria-label={`Decision note for ${affiliate.name}`}
          />
          <Button
            size="sm"
            onClick={() =>
              void decide.mutateAsync({
                affiliatePublicId: affiliate.publicId,
                decision: 'approve',
                note: note || undefined,
              })
            }
            disabled={decide.isPending}
          >
            <CheckIcon aria-hidden /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void decide.mutateAsync({
                affiliatePublicId: affiliate.publicId,
                decision: 'decline',
                note: note || undefined,
              })
            }
            disabled={decide.isPending}
          >
            <XIcon aria-hidden /> Decline
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function InviteAffiliateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const invite = useInviteAffiliate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [audience, setAudience] = useState('')
  const [channels, setChannels] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Affiliate</DialogTitle>
          <DialogDescription>
            Lightweight application: name, audience, and promotion channels. Approved affiliates get
            unique links.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="affiliate-name">Name</Label>
            <Input
              id="affiliate-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="affiliate-email">Email</Label>
            <Input
              id="affiliate-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="affiliate-audience">Audience</Label>
            <Input
              id="affiliate-audience"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              placeholder="TOEFL prep students in Ethiopia"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="affiliate-channels">Promotion channels</Label>
            <Input
              id="affiliate-channels"
              value={channels}
              onChange={(event) => setChannels(event.target.value)}
              placeholder="YouTube, Telegram"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await invite.mutateAsync({
                name,
                email,
                audience: audience || undefined,
                channels: channels || undefined,
              })
              onOpenChange(false)
              setName('')
              setEmail('')
              setAudience('')
              setChannels('')
            }}
            disabled={invite.isPending || !name.trim() || !email.trim()}
          >
            Save application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProgramSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const programQuery = useQuery(affiliateProgramQueryOptions())
  const save = useSaveProgramSettings()
  const program = programQuery.data

  const [commission, setCommission] = useState('')
  const [cookieWindow, setCookieWindow] = useState('')
  const [threshold, setThreshold] = useState('')
  const [method, setMethod] = useState('bank_transfer')

  useEffect(() => {
    if (!open || !program) return
    setCommission(String(program.settings.commissionPercent))
    setCookieWindow(String(program.settings.cookieWindowDays))
    setThreshold(String(program.settings.payoutThreshold))
    setMethod(program.settings.payoutMethod)
  }, [open, program])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Program Settings</DialogTitle>
          <DialogDescription>
            Commission changes apply prospectively — historical commissions never recompute.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="program-commission">Commission (%)</Label>
            <Input
              id="program-commission"
              type="number"
              min={1}
              max={99}
              value={commission}
              onChange={(event) => setCommission(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="program-cookie">Cookie window (days)</Label>
            <Input
              id="program-cookie"
              type="number"
              min={1}
              max={365}
              value={cookieWindow}
              onChange={(event) => setCookieWindow(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="program-threshold">Payout threshold</Label>
            <Input
              id="program-threshold"
              type="number"
              min={0}
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="program-method">Payout method</Label>
            <select
              id="program-method"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="bank_transfer">Bank transfer</option>
              <option value="manual">Manual</option>
              <option value="gift_card">Gift card</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await save.mutateAsync({
                commissionPercent: Number(commission),
                cookieWindowDays: Number(cookieWindow),
                payoutThreshold: Number(threshold),
                payoutMethod: method as 'bank_transfer',
              })
              onOpenChange(false)
            }}
            disabled={save.isPending}
          >
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AffiliateDetailDialog({
  affiliate,
  onOpenChange,
}: {
  affiliate: AffiliateRow | null
  onOpenChange: (open: boolean) => void
}) {
  const role = useRole()
  const canWrite = role === 'admin' || role === 'editor'
  const flagFraud = useFlagAffiliateFraud()

  return (
    <Dialog open={affiliate != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {affiliate?.name}
            {affiliate ? (
              <MarketingStatusBadge domain="affiliate" status={affiliate.status} />
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {affiliate?.audience ?? 'No audience description'} ·{' '}
            {affiliate?.channels ?? 'No channels listed'}
          </DialogDescription>
        </DialogHeader>

        {affiliate ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Stat label="Clicks" value={formatInteger(affiliate.clicks)} />
              <Stat label="Sales" value={formatInteger(affiliate.sales)} />
              <Stat label="Revenue" value={formatCurrency(affiliate.revenue)} />
              <Stat label="Owed" value={formatCurrency(affiliate.owed)} />
            </div>

            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Referral links
              </h4>
              <ul className="space-y-1">
                {affiliate.links.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No links generated yet.</li>
                ) : (
                  affiliate.links.map((link) => (
                    <li key={link.code} className="rounded-md border px-3 py-1.5 font-mono text-xs">
                      {link.code}
                      {link.courseTitle ? (
                        <span className="font-sans text-muted-foreground">
                          {' '}
                          · {link.courseTitle}
                        </span>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </div>

            {affiliate.fraudEvidence ? (
              <div
                className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
                role="alert"
              >
                <p className="font-medium text-destructive">🚩 {affiliate.fraudEvidence.reason}</p>
                {affiliate.fraudEvidence.detail ? (
                  <p className="text-muted-foreground">{affiliate.fraudEvidence.detail}</p>
                ) : null}
              </div>
            ) : null}

            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                {affiliate.commissionsHeld ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      void flagFraud
                        .mutateAsync({ affiliatePublicId: affiliate.publicId, hold: false })
                        .then(() => onOpenChange(false))
                    }
                    disabled={flagFraud.isPending}
                  >
                    Release commissions
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() =>
                      void flagFraud
                        .mutateAsync({ affiliatePublicId: affiliate.publicId, hold: true })
                        .then(() => onOpenChange(false))
                    }
                    disabled={flagFraud.isPending}
                  >
                    <BanIcon aria-hidden /> Hold commissions
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  )
}

function PayoutConfirmDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pendingQuery = useQuery({ ...pendingPayoutsQueryOptions(), enabled: open })
  const runPayouts = useRunPayouts()

  const rows = pendingQuery.data?.rows ?? []
  const eligible = rows.filter((row) => row.eligible)
  const failing = rows.filter((row) => !row.eligible)
  const total = eligible.reduce((sum, row) => sum + row.owed, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Run payout</DialogTitle>
          <DialogDescription>
            {pendingQuery.isLoading
              ? 'Loading…'
              : `${eligible.length} affiliate${eligible.length === 1 ? '' : 's'} · ${formatCurrency(total)} total`}
          </DialogDescription>
        </DialogHeader>

        {failing.length > 0 ? (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
              Not paid (with reasons)
            </h4>
            <ul className="space-y-1">
              {failing.map((row) => (
                <li key={row.affiliatePublicId} className="rounded-md border px-3 py-2 text-sm">
                  <span className="font-medium">{row.name}</span>
                  <ul className="text-xs text-muted-foreground">
                    {row.reasons.map((reason) => (
                      <li key={reason}>· {reason}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await runPayouts.mutateAsync()
              onOpenChange(false)
            }}
            disabled={pendingQuery.isLoading || runPayouts.isPending || eligible.length === 0}
          >
            Mark {eligible.length} as paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
