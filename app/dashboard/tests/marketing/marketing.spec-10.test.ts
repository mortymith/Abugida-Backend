import { describe, expect, test } from 'bun:test'
import {
  campaignUpdateSchema,
  couponBatchSchema,
  couponCreateSchema,
} from '#/features/marketing/schemas/marketing.schema'
import { marketingQueryKeys } from '#/features/marketing/hooks/marketing.queries'
import {
  canTransition,
  describeAudience,
  isDuplicatable,
  isEditable,
  isMetricsUpdating,
  requiresLargeSendConfirmation,
  LARGE_SEND_THRESHOLD,
} from '#/features/marketing/marketing.campaign-states'
import {
  buildCouponCsv,
  generateCouponCodes,
  MAX_BATCH_SIZE,
  normalizeCouponCode,
} from '#/features/marketing/marketing.coupon-codes'
import {
  buildPayoutRunRows,
  computeCommissionAmount,
  summarizePayoutRun,
} from '#/features/marketing/marketing.commission-math'
import { isHeavyEdit, isQuoteLengthValid } from '#/features/marketing/marketing.testimonial-rules'
import { MAX_TEMPLATE_BLOCKS } from '#/features/marketing/marketing.email-render'

/**
 * Spec 10 (Marketing & Growth) pure-logic suite. These cover the rules the UI
 * renders and the server enforces, plus the query-key scoping the mutations
 * depend on for cache invalidation.
 */

describe('marketing schema module', () => {
  /**
   * Regression guard. `couponBatchSchema` used to be derived from
   * `couponCreateSchema` with `.omit()`, but that schema carries `.refine()`
   * calls and Zod v4 throws ".omit() cannot be used on object schemas
   * containing refinements" — at *module load*, which took down every
   * marketing server function and left the whole tab dead. The schemas below
   * are only constructible if the module imports cleanly, so simply touching
   * them here is the assertion.
   */
  test('every schema builds and parses', () => {
    const create = couponCreateSchema.parse({
      code: 'TOEFL25',
      kind: 'percentage',
      value: 25,
    })
    expect(create.kind).toBe('percentage')
    expect(create.stackable).toBe(false)

    // The batch schema drops `code`/`maxRedemptions` and adds `count`.
    const batch = couponBatchSchema.parse({ kind: 'fixed', value: 10, count: 500 })
    expect(batch.count).toBe(500)
    expect(batch).not.toHaveProperty('code')
    expect(batch).not.toHaveProperty('maxRedemptions')
  })

  test('a percentage outside 1-99 is rejected', () => {
    expect(() => couponCreateSchema.parse({ kind: 'percentage', value: 120 })).toThrow(
      /between 1 and 99/,
    )
  })

  test('a full-access code needs no value', () => {
    expect(couponCreateSchema.parse({ kind: 'full_access' }).value).toBeUndefined()
  })

  test('a fixed amount requires a positive value', () => {
    expect(() => couponCreateSchema.parse({ kind: 'fixed' })).toThrow(/value is required/)
  })

  test('campaign update extends the create schema with an id', () => {
    const parsed = campaignUpdateSchema.parse({
      campaignPublicId: '2f1c0f3e-0000-4000-8000-000000000000',
      name: 'Sept. TOEFL push',
      subject: 'Seats are limited',
      audience: { cohortPublicIds: [], coursePublicIds: [], tags: [], activity: 'any' },
    })
    expect(parsed.name).toBe('Sept. TOEFL push')
    // The id is what the update schema adds over the create schema.
    expect(campaignUpdateSchema.safeParse({ ...parsed, campaignPublicId: undefined }).success).toBe(
      false,
    )
  })
})

describe('marketing query keys', () => {
  /**
   * `invalidateQueries` matches by key *prefix*. A mutation that invalidates
   * only one leaf would leave every other active filter showing stale data —
   * this asserts each list scope really is a prefix of its own entries.
   */
  const isPrefixOf = (prefix: readonly unknown[], key: readonly unknown[]) =>
    key.length > prefix.length && prefix.every((part, index) => part === key[index])

  test('campaign list scope covers every status filter', () => {
    const scope = marketingQueryKeys.campaignsRoot()
    for (const status of ['all', 'draft', 'scheduled', 'sending', 'sent', 'cancelled']) {
      expect(isPrefixOf(scope, marketingQueryKeys.campaigns(status))).toBe(true)
    }
  })

  test('campaign detail scope covers every campaign', () => {
    const scope = marketingQueryKeys.campaignRoot()
    expect(isPrefixOf(scope, marketingQueryKeys.campaign('some-uuid'))).toBe(true)
  })

  test('the detail scope is not a prefix of the list scope', () => {
    // `campaigns` vs `campaign` share a string prefix by accident, not by
    // array prefix — invalidating the detail scope must not wipe the list.
    expect(isPrefixOf(marketingQueryKeys.campaignRoot(), marketingQueryKeys.campaigns('all'))).toBe(
      false,
    )
  })

  test('coupon scope covers the redemption log', () => {
    expect(isPrefixOf(marketingQueryKeys.couponsRoot(), marketingQueryKeys.coupons('active'))).toBe(
      true,
    )
    expect(
      isPrefixOf(
        marketingQueryKeys.couponRedemptionsRoot(),
        marketingQueryKeys.couponRedemptions('coupon-uuid'),
      ),
    ).toBe(true)
  })

  test('testimonial scope covers every status/course filter combination', () => {
    const scope = marketingQueryKeys.testimonialsRoot()
    const courses = ['all', '2f1c0f3e-0000-4000-8000-000000000000'] as const
    for (const status of ['pending', 'published'] as const) {
      for (const course of courses) {
        expect(isPrefixOf(scope, marketingQueryKeys.testimonials({ status, course }))).toBe(true)
      }
    }
  })

  test('affiliate scope covers every status filter', () => {
    const scope = marketingQueryKeys.affiliatesRoot()
    for (const status of ['all', 'pending', 'approved', 'suspended', 'declined']) {
      expect(isPrefixOf(scope, marketingQueryKeys.affiliates(status))).toBe(true)
    }
  })

  test('the root scope covers the whole module', () => {
    const root = marketingQueryKeys.root()
    expect(isPrefixOf(root, marketingQueryKeys.campaigns('all'))).toBe(true)
    expect(isPrefixOf(root, marketingQueryKeys.templates())).toBe(true)
    expect(isPrefixOf(root, marketingQueryKeys.testimonialSettings())).toBe(true)
  })
})

describe('campaign lifecycle (S-8.1)', () => {
  test('a draft may be scheduled or sent', () => {
    expect(canTransition('draft', 'scheduled')).toBe(true)
    expect(canTransition('draft', 'sending')).toBe(true)
  })

  test('a scheduled send can be cancelled, a sent one cannot', () => {
    expect(canTransition('scheduled', 'cancelled')).toBe(true)
    expect(canTransition('sent', 'cancelled')).toBe(false)
  })

  test('sent and cancelled are terminal', () => {
    expect(canTransition('sent', 'draft')).toBe(false)
    expect(canTransition('cancelled', 'scheduled')).toBe(false)
  })

  test('editing is allowed pre-send only', () => {
    expect(isEditable('draft')).toBe(true)
    expect(isEditable('scheduled')).toBe(true)
    expect(isEditable('sending')).toBe(false)
    expect(isEditable('sent')).toBe(false)
  })

  /**
   * The server rejects duplicating a scheduled campaign with CAMPAIGN_BUSY, so
   * the UI must not offer the action for that state.
   */
  test('a scheduled campaign is not duplicatable', () => {
    expect(isDuplicatable('draft')).toBe(true)
    expect(isDuplicatable('sent')).toBe(true)
    expect(isDuplicatable('cancelled')).toBe(true)
    expect(isDuplicatable('scheduled')).toBe(false)
    expect(isDuplicatable('sending')).toBe(false)
  })

  test('the large-send confirmation triggers above the threshold', () => {
    expect(requiresLargeSendConfirmation(LARGE_SEND_THRESHOLD)).toBe(false)
    expect(requiresLargeSendConfirmation(LARGE_SEND_THRESHOLD + 1)).toBe(true)
  })

  test('metrics only lag for the first hour after a send', () => {
    const sentAt = new Date('2026-03-01T12:00:00.000Z')
    const halfHourLater = new Date('2026-03-01T12:30:00.000Z')
    const twoHoursLater = new Date('2026-03-01T14:00:00.000Z')

    expect(isMetricsUpdating(sentAt.toISOString(), halfHourLater)).toBe(true)
    expect(isMetricsUpdating(sentAt.toISOString(), twoHoursLater)).toBe(false)
  })

  test('an unsent campaign never reports "metrics updating"', () => {
    // A null sentAt must not shimmer forever — the rate cell shows a dash.
    expect(isMetricsUpdating(null)).toBe(false)
    expect(isMetricsUpdating('not-a-date')).toBe(false)
  })
})

describe('describeAudience', () => {
  const base = {
    cohortPublicIds: [] as string[],
    coursePublicIds: [] as string[],
    tags: [] as string[],
    activity: 'any' as const,
  }

  test('an empty segment is "All contacts"', () => {
    expect(describeAudience(base)).toBe('All contacts')
  })

  test('counts and pluralises cohorts and courses', () => {
    expect(
      describeAudience({
        ...base,
        cohortPublicIds: ['a', 'b'],
        coursePublicIds: ['c'],
        activity: 'active_30d',
      }),
    ).toBe('2 cohorts · 1 course · Active in last 30 days')
  })

  test('lists tags inline', () => {
    expect(describeAudience({ ...base, tags: ['vip', 'tof'] })).toBe('tags: vip, tof')
  })
})

describe('coupon codes (S-8.3)', () => {
  /**
   * Seeded xorshift32 — deterministic and well distributed enough that 200
   * six-character codes don't collide, unlike a linear ramp into the same
   * alphabet bucket.
   */
  function seededRandom(seed = 0x2f6e2b1): () => number {
    let state = seed
    return () => {
      state ^= state << 13
      state ^= state >>> 17
      state ^= state << 5
      state >>>= 0
      return state / 0x1_0000_0000
    }
  }

  test('codes are uppercase and unique', () => {
    const codes = generateCouponCodes(50, { random: seededRandom() })
    expect(new Set(codes).size).toBe(50)
    for (const code of codes) {
      expect(code).toBe(code.toUpperCase())
      expect(code).toMatch(/^[A-Z0-9-]+$/)
    }
  })

  test('excludes visually ambiguous characters', () => {
    const codes = generateCouponCodes(200, { random: seededRandom(0x9e3779b9) })
    expect(codes.join('')).not.toMatch(/[01OIL]/)
  })

  test('rejects a batch size outside the allowed range', () => {
    expect(() => generateCouponCodes(0)).toThrow('INVALID_BATCH_SIZE')
    expect(() => generateCouponCodes(MAX_BATCH_SIZE + 1)).toThrow('INVALID_BATCH_SIZE')
  })

  test('normalises a code for case-insensitive checkout matching', () => {
    expect(normalizeCouponCode('  toefl25 ')).toBe('TOEFL25')
  })

  test('the batch CSV has a header and one row per code', () => {
    const codes = ['TOEFL25', 'EARLY10']
    const csv = buildCouponCsv(codes, { expiresAt: '2026-10-31' })
    const lines = csv.trim().split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('code')
    expect(lines[1]).toContain('TOEFL25')
    expect(lines[1]).toContain('2026-10-31')
  })
})

describe('affiliate commissions and payouts (S-8.4)', () => {
  test('commission rounds to the currency cents', () => {
    expect(computeCommissionAmount(56, 20)).toBe(11.2)
    expect(computeCommissionAmount(99.99, 33)).toBe(33)
  })

  test('non-finite input yields no commission', () => {
    expect(computeCommissionAmount(Number.NaN, 20)).toBe(0)
    expect(computeCommissionAmount(100, Number.POSITIVE_INFINITY)).toBe(0)
  })

  const affiliate = (overrides: Partial<Parameters<typeof buildPayoutRunRows>[0][number]>) => ({
    affiliatePublicId: 'a1',
    name: 'Sara B.',
    status: 'approved' as const,
    commissionsHeld: false,
    hasPayoutDetails: true,
    owed: 426,
    ...overrides,
  })

  test('an approved affiliate over the threshold is payable', () => {
    const [row] = buildPayoutRunRows([affiliate({})], 50)
    expect(row.eligible).toBe(true)
    expect(row.reasons).toEqual([])
  })

  test('each failing condition is reported per affiliate', () => {
    const [row] = buildPayoutRunRows(
      [affiliate({ status: 'suspended', commissionsHeld: true, hasPayoutDetails: false })],
      50,
    )
    expect(row.eligible).toBe(false)
    expect(row.reasons).toHaveLength(3)
  })

  test('below-threshold affiliates are not payable', () => {
    const [row] = buildPayoutRunRows([affiliate({ owed: 20 })], 50)
    expect(row.eligible).toBe(false)
  })

  test('a zero balance is never paid out', () => {
    const [row] = buildPayoutRunRows([affiliate({ owed: 0 })], 0)
    expect(row.eligible).toBe(false)
  })

  test('the summary totals only the eligible rows', () => {
    const summary = summarizePayoutRun(
      buildPayoutRunRows(
        [affiliate({ owed: 100 }), affiliate({ affiliatePublicId: 'a2', owed: 40 })],
        50,
      ),
    )
    expect(summary).toEqual({ paidCount: 1, paidTotal: 100 })
  })

  test('an empty run pays nobody', () => {
    expect(summarizePayoutRun([])).toEqual({ paidCount: 0, paidTotal: 0 })
  })
})

describe('testimonial rules (S-8.5)', () => {
  test('quote length must sit inside the spec bounds', () => {
    expect(isQuoteLengthValid('a'.repeat(19))).toBe(false)
    expect(isQuoteLengthValid('a'.repeat(20))).toBe(true)
    expect(isQuoteLengthValid('a'.repeat(400))).toBe(true)
    expect(isQuoteLengthValid('a'.repeat(401))).toBe(false)
  })

  test('an edit well beyond a typo fix is flagged as heavy', () => {
    const original = 'The 12-week plan took me from 79 to 101.'
    expect(isHeavyEdit(original, `${original} `)).toBe(false)
    expect(
      isHeavyEdit(original, 'Completely different wording that the student never said at all.'),
    ).toBe(true)
  })
})

describe('template document limits (S-8.2)', () => {
  test('the block cap matches the server schema', () => {
    expect(MAX_TEMPLATE_BLOCKS).toBe(25)
  })
})
