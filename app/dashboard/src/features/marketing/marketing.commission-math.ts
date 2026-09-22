/**
 * Affiliate commission and payout math (spec 10 S-8.4) — pure module so the
 * payout-run preview the admin confirms and the server write produce the
 * same numbers. Commission changes apply prospectively: each commission row
 * snapshots the program rate at sale time and is never recomputed.
 */

export interface CommissionLike {
  id: string
  status: 'pending' | 'held' | 'paid' | 'reversed'
  amount: number
}

export interface AffiliateForPayout {
  affiliatePublicId: string
  name: string
  status: 'pending' | 'approved' | 'suspended' | 'declined'
  commissionsHeld: boolean
  hasPayoutDetails: boolean
  owed: number
}

/** Commission amount for a sale — rounded half-up to the currency's cents. */
export function computeCommissionAmount(saleAmount: number, ratePercent: number): number {
  if (!Number.isFinite(saleAmount) || !Number.isFinite(ratePercent)) return 0
  const raw = (saleAmount * ratePercent) / 100
  return Math.round(raw * 100) / 100
}

/** Sum of payable (pending, not held) commissions. */
export function owedFromCommissions(commissions: CommissionLike[]): number {
  return round2(
    commissions.filter((c) => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0),
  )
}

/** Held commissions — frozen while fraud is reviewed, resumed on clear. */
export function heldFromCommissions(commissions: CommissionLike[]): number {
  return round2(
    commissions.filter((c) => c.status === 'held').reduce((sum, c) => sum + c.amount, 0),
  )
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Build the payout-run preview (S-8.4 summary modal): affiliates meeting the
 * threshold with valid payout details are eligible; failing rows carry the
 * per-affiliate reasons the spec requires the admin to see.
 */
export function buildPayoutRunRows(
  affiliates: AffiliateForPayout[],
  threshold: number,
): PayoutRunRowLike[] {
  return affiliates.map((affiliate) => {
    const reasons: string[] = []
    if (affiliate.status !== 'approved') reasons.push('Affiliate is not approved')
    if (affiliate.commissionsHeld) reasons.push('Commissions are held for review')
    if (!affiliate.hasPayoutDetails) reasons.push('No valid payout details on file')
    if (affiliate.owed < threshold) {
      reasons.push(`Owed ${affiliate.owed} is below the ${threshold} payout threshold`)
    }
    return {
      affiliatePublicId: affiliate.affiliatePublicId,
      name: affiliate.name,
      owed: affiliate.owed,
      eligible: reasons.length === 0 && affiliate.owed > 0,
      reasons,
    }
  })
}

export interface PayoutRunRowLike {
  affiliatePublicId: string
  name: string
  owed: number
  eligible: boolean
  reasons: string[]
}

export function summarizePayoutRun(rows: PayoutRunRowLike[]): {
  paidCount: number
  paidTotal: number
} {
  const eligible = rows.filter((row) => row.eligible)
  return {
    paidCount: eligible.length,
    paidTotal: round2(eligible.reduce((sum, row) => sum + row.owed, 0)),
  }
}
