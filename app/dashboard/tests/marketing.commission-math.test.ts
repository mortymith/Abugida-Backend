import { describe, expect, test } from 'bun:test'
import {
  buildPayoutRunRows,
  computeCommissionAmount,
  heldFromCommissions,
  owedFromCommissions,
  round2,
  summarizePayoutRun,
} from '#/features/marketing/marketing.commission-math'

/**
 * S-8.4 commission and payout math (spec 10): rate snapshots per sale,
 * pending vs held sums, threshold-qualified payout rows with reasons, and
 * run summaries. Historical commissions never recompute — only new sales
 * take the current rate.
 */
describe('commission math', () => {
  test('computes the commission amount from a snapshot rate', () => {
    expect(computeCommissionAmount(2128, 20)).toBe(425.6)
    expect(computeCommissionAmount(674, 20)).toBe(134.8)
    expect(computeCommissionAmount(99.99, 15)).toBe(15.0)
  })

  test('handles non-finite inputs defensively', () => {
    expect(computeCommissionAmount(Number.NaN, 20)).toBe(0)
    expect(computeCommissionAmount(100, Number.NaN)).toBe(0)
  })

  test('sums pending commissions as owed and excludes held/paid', () => {
    const commissions = [
      { id: '1', status: 'pending' as const, amount: 100 },
      { id: '2', status: 'pending' as const, amount: 50.5 },
      { id: '3', status: 'held' as const, amount: 75 },
      { id: '4', status: 'paid' as const, amount: 25 },
      { id: '5', status: 'reversed' as const, amount: 10 },
    ]
    expect(owedFromCommissions(commissions)).toBe(150.5)
    expect(heldFromCommissions(commissions)).toBe(75)
  })

  test('rounds to currency cents', () => {
    expect(round2(10.005)).toBe(10.01)
    expect(round2(1.0049999)).toBe(1.0)
  })

  test('payout rows qualify only when every requirement is met', () => {
    const rows = buildPayoutRunRows(
      [
        {
          affiliatePublicId: 'a',
          name: 'Sara B.',
          status: 'approved',
          commissionsHeld: false,
          hasPayoutDetails: true,
          owed: 426,
        },
        {
          affiliatePublicId: 'b',
          name: 'Daniel W.',
          status: 'approved',
          commissionsHeld: false,
          hasPayoutDetails: false,
          owed: 135,
        },
        {
          affiliatePublicId: 'c',
          name: 'Held H.',
          status: 'approved',
          commissionsHeld: true,
          hasPayoutDetails: true,
          owed: 900,
        },
        {
          affiliatePublicId: 'd',
          name: 'Low L.',
          status: 'approved',
          commissionsHeld: false,
          hasPayoutDetails: true,
          owed: 10,
        },
        {
          affiliatePublicId: 'e',
          name: 'Susp. S.',
          status: 'suspended',
          commissionsHeld: false,
          hasPayoutDetails: true,
          owed: 500,
        },
      ],
      50,
    )

    expect(rows.find((row) => row.affiliatePublicId === 'a')?.eligible).toBe(true)
    const failing = rows.filter((row) => !row.eligible)
    expect(failing.map((row) => row.affiliatePublicId)).toEqual(['b', 'c', 'd', 'e'])
    expect(failing.find((row) => row.affiliatePublicId === 'd')?.reasons.join(' ')).toContain(
      'below the 50 payout threshold',
    )
  })

  test('zero-owed affiliates are not eligible even when requirements pass', () => {
    const rows = buildPayoutRunRows(
      [
        {
          affiliatePublicId: 'a',
          name: 'Zero Z.',
          status: 'approved',
          commissionsHeld: false,
          hasPayoutDetails: true,
          owed: 0,
        },
      ],
      50,
    )
    expect(rows[0]?.eligible).toBe(false)
  })

  test('summarizes the run total over eligible rows only', () => {
    const { paidCount, paidTotal } = summarizePayoutRun([
      { affiliatePublicId: 'a', name: 'A', owed: 426, eligible: true, reasons: [] },
      { affiliatePublicId: 'b', name: 'B', owed: 135, eligible: true, reasons: [] },
      { affiliatePublicId: 'c', name: 'C', owed: 900, eligible: false, reasons: ['held'] },
    ])
    expect(paidCount).toBe(2)
    expect(paidTotal).toBe(561)
  })
})
