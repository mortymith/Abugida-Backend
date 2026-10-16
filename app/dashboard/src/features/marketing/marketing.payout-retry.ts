/**
 * S-8.4 Payout retry + reconciliation logic (spec 10 Rev-3).
 * Retry-with-new-details (primary), retry-as-is (capped at 3),
 * Telebirr micro-deposit verification, negative balances, reconciliation.
 */

export const MAX_PAYOUT_ATTEMPTS = 3

export interface PayoutState {
  readonly status: 'pending' | 'paid' | 'failed'
  readonly attemptCount: number
  readonly method: string
  readonly isFirstPayout: boolean
}

export function canRetryPayout(payout: PayoutState): { permitted: boolean; reason: string | null } {
  if (payout.status !== 'failed') {
    return { permitted: false, reason: 'Only failed payouts can be retried.' }
  }
  if (payout.attemptCount >= MAX_PAYOUT_ATTEMPTS) {
    return {
      permitted: false,
      reason: `Maximum ${MAX_PAYOUT_ATTEMPTS} attempts reached. Retry with new details.`,
    }
  }
  return { permitted: true, reason: null }
}

export function canRetryWithNewDetails(payout: PayoutState): boolean {
  return payout.status === 'failed'
}

export function canRetryAsIs(payout: PayoutState): boolean {
  return payout.status === 'failed' && payout.attemptCount < MAX_PAYOUT_ATTEMPTS
}

export function attemptCountLabel(count: number): string {
  return `Attempt ${count} of ${MAX_PAYOUT_ATTEMPTS}`
}

export function retryWithNewDetailsLabel(): string {
  return 'Retry with new details'
}

export function retryAsIsLabel(): string {
  return 'Retry as-is'
}

// ── Telebirr micro-deposit ─────────────────────────────────────────────────

export type MicroDepositStatus = 'not_required' | 'pending' | 'verified' | 'failed'

export function microDepositRequired(method: string, isFirstPayout: boolean): boolean {
  return method === 'telebirr' && isFirstPayout
}

export function microDepositStatusLabel(status: MicroDepositStatus): string {
  switch (status) {
    case 'not_required':
      return ''
    case 'pending':
      return 'Pending verification'
    case 'verified':
      return 'Verified'
    case 'failed':
      return 'Verification failed'
  }
}

// ── Reconciliation ──────────────────────────────────────────────────────────

export interface ReconciliationInput {
  readonly expectedAmount: number
  readonly payableAmount: number
  readonly deferredAmount: number
  readonly negativeBalanceCarry: number
}

export interface ReconciliationResult {
  readonly variance: number
  readonly isBalanced: boolean
  readonly label: string
}

export function computeReconciliation(input: ReconciliationInput): ReconciliationResult {
  const variance = input.expectedAmount - input.payableAmount
  const isBalanced = Math.abs(variance) < 0.01
  let label: string
  if (isBalanced) {
    label = 'Balanced'
  } else if (variance > 0) {
    label = `Variance: ${variance.toFixed(2)} under — investigate`
  } else {
    label = `Variance: ${Math.abs(variance).toFixed(2)} over — investigate`
  }
  return { variance, isBalanced, label }
}

export function negativeBalanceLabel(balance: number, currency: string = 'ETB'): string | null {
  if (balance >= 0) return null
  return `Negative balance: ${currency} ${balance.toFixed(2)} (offsets next payout)`
}

export function conversionRateLabel(rate: number, date: string): string {
  return `Rate frozen: 1 USD = ${rate.toFixed(2)} ETB (${date})`
}
