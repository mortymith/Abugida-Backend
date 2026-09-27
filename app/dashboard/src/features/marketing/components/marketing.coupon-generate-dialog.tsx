import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DownloadIcon } from 'lucide-react'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
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
import { composerReferenceQueryOptions } from '../hooks/marketing.queries'
import { useCreateCoupon, useGenerateCouponBatch } from '../hooks/marketing.mutations'
import { buildCouponCsv, MAX_BATCH_SIZE } from '../marketing.coupon-codes'
import type { CouponKindValue } from '../marketing.types'

/**
 * S-8.3 generator: percentage / fixed amount / 100% access, scope to
 * specific courses, multi-use limit or a single-use batch, expiry, and the
 * stackable flag. Full-access codes on paid courses confirm first (revenue
 * impact); batches hand back a CSV immediately.
 */
export function CouponGeneratorDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const referenceQuery = useQuery(composerReferenceQueryOptions())

  const [kind, setKind] = useState<CouponKindValue>('percentage')
  const [value, setValue] = useState('25')
  const [code, setCode] = useState('')
  const [coursePublicId, setCoursePublicId] = useState<string>('any')
  const [mode, setMode] = useState<'multi' | 'single'>('multi')
  const [maxRedemptions, setMaxRedemptions] = useState('500')
  const [batchCount, setBatchCount] = useState('500')
  const [batchPrefix, setBatchPrefix] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [stackable, setStackable] = useState(false)
  const [fullAccessConfirm, setFullAccessConfirm] = useState(false)
  const [batchResult, setBatchResult] = useState<{
    codes: string[]
    expiresAt: string | null
  } | null>(null)

  const createCoupon = useCreateCoupon()
  const generateBatch = useGenerateCouponBatch()

  const parsedValue = Number(value)
  const valid =
    (kind === 'full_access' || (Number.isFinite(parsedValue) && parsedValue > 0)) &&
    (kind !== 'percentage' || (parsedValue >= 1 && parsedValue <= 99))

  const buildCommon = () => ({
    kind,
    value: kind === 'full_access' ? undefined : parsedValue,
    scopeCoursePublicIds: coursePublicId === 'any' ? [] : [coursePublicId],
    expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : undefined,
    stackable,
  })

  const handleGenerate = async () => {
    if (!valid) return
    if (mode === 'multi') {
      await createCoupon.mutateAsync({
        ...(code.trim() ? { code: code.trim() } : {}),
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
        ...buildCommon(),
      })
      onOpenChange(false)
      return
    }
    const count = Math.min(Math.max(Number(batchCount) || 1, 1), MAX_BATCH_SIZE)
    const result = await generateBatch.mutateAsync({
      count,
      prefix: batchPrefix.trim() || undefined,
      batchLabel: `Batch of ${count}${batchPrefix ? ` (${batchPrefix})` : ''}`,
      ...buildCommon(),
    })
    setBatchResult({ codes: result.codes, expiresAt: result.expiresAt })
  }

  const pending = createCoupon.isPending || generateBatch.isPending

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Generate Codes</DialogTitle>
            <DialogDescription>
              Codes are case-insensitive at checkout and displayed uppercase. Duplicate codes are
              rejected.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <fieldset className="rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">Type</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    { value: 'percentage', label: 'Percentage' },
                    { value: 'fixed', label: 'Fixed amount' },
                    { value: 'full_access', label: '100% access' },
                  ] as const
                ).map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="coupon-kind"
                      value={option.value}
                      checked={kind === option.value}
                      onChange={() => setKind(option.value)}
                      className="accent-primary"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              {kind !== 'full_access' ? (
                <div className="mt-3 grid gap-2">
                  <Label htmlFor="coupon-value">Value</Label>
                  <Input
                    id="coupon-value"
                    type="number"
                    min={kind === 'percentage' ? 1 : 0.01}
                    max={kind === 'percentage' ? 99 : undefined}
                    step={kind === 'percentage' ? 1 : 0.01}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                  />
                  {kind === 'percentage' ? (
                    <p className="text-xs text-muted-foreground">Percentage between 1 and 99.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Must be smaller than the scoped course price.
                    </p>
                  )}
                </div>
              ) : null}
            </fieldset>

            <div className="grid gap-2">
              <Label htmlFor="coupon-scope">Scope</Label>
              <select
                id="coupon-scope"
                aria-label="Course scope"
                className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                value={coursePublicId}
                onChange={(event) => setCoursePublicId(event.target.value)}
              >
                <option value="any">Any course</option>
                {(referenceQuery.data?.courses ?? []).map((course) => (
                  <option key={course.publicId} value={course.publicId}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">Limit</legend>
              <div className="grid gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="coupon-mode"
                    value="multi"
                    checked={mode === 'multi'}
                    onChange={() => setMode('multi')}
                    className="accent-primary"
                  />
                  Multi-use
                </label>
                {mode === 'multi' ? (
                  <div className="grid gap-2">
                    <Label htmlFor="coupon-max">Maximum redemptions (empty = ∞)</Label>
                    <Input
                      id="coupon-max"
                      type="number"
                      min={1}
                      value={maxRedemptions}
                      onChange={(event) => setMaxRedemptions(event.target.value)}
                      placeholder="500"
                    />
                  </div>
                ) : null}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="coupon-mode"
                    value="single"
                    checked={mode === 'single'}
                    onChange={() => setMode('single')}
                    className="accent-primary"
                  />
                  Single-use batch → export CSV
                </label>
                {mode === 'single' ? (
                  <div className="grid gap-2">
                    <Label htmlFor="coupon-batch-count">Unique codes (max {MAX_BATCH_SIZE})</Label>
                    <Input
                      id="coupon-batch-count"
                      type="number"
                      min={1}
                      max={MAX_BATCH_SIZE}
                      value={batchCount}
                      onChange={(event) => setBatchCount(event.target.value)}
                    />
                    <Label htmlFor="coupon-batch-prefix">Prefix (optional)</Label>
                    <Input
                      id="coupon-batch-prefix"
                      value={batchPrefix}
                      onChange={(event) => setBatchPrefix(event.target.value)}
                      placeholder="ACME"
                      maxLength={20}
                    />
                  </div>
                ) : null}
              </div>
            </fieldset>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="coupon-code">Code (single mode only)</Label>
                <Input
                  id="coupon-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="TOEFL25"
                  disabled={mode === 'single'}
                  maxLength={40}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="coupon-expiry">Expiry</Label>
                <Input
                  id="coupon-expiry"
                  type="date"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={stackable}
                onChange={(event) => setStackable(event.target.checked)}
                className="accent-primary"
              />
              Stackable with course discounts
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (kind === 'full_access' && !fullAccessConfirm) {
                  // Spec: 100%-access codes on paid courses require an
                  // S-7.1 confirmation (revenue impact).
                  setFullAccessConfirm(true)
                  return
                }
                void handleGenerate()
              }}
              disabled={!valid || pending}
            >
              {mode === 'single' ? 'Generate batch' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={fullAccessConfirm}
        onOpenChange={setFullAccessConfirm}
        title="Grant full free access?"
        body="100%-access codes waive the entire course price. This has direct revenue impact — make sure the scope and distribution plan are correct."
        confirmLabel="Grant full access"
        onConfirm={() => {
          setFullAccessConfirm(false)
          return handleGenerate()
        }}
      />

      <Dialog
        open={batchResult != null}
        onOpenChange={(nextOpen) => !nextOpen && setBatchResult(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{batchResult?.codes.length} codes created</DialogTitle>
            <DialogDescription>
              Export the CSV now — codes are one-time-use per redemption.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-40 overflow-y-auto rounded-md bg-muted p-3 font-mono text-xs">
            {batchResult?.codes.slice(0, 50).join('\n')}
            {batchResult && batchResult.codes.length > 50 ? '\n…' : null}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (batchResult) {
                  const csv = buildCouponCsv(batchResult.codes, {
                    expiresAt: batchResult.expiresAt,
                  })
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const anchor = document.createElement('a')
                  anchor.href = url
                  anchor.download = 'coupon-batch.csv'
                  anchor.click()
                  URL.revokeObjectURL(url)
                }
              }}
            >
              <DownloadIcon aria-hidden /> Export CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
