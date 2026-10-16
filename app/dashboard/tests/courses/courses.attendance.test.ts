import { describe, expect, test } from 'bun:test'
import {
  canApplyManualOverride,
  effectiveStatus,
  reconcileAttendance,
  summarizeAttendance,
} from '#/features/courses/courses.attendance'
import type { AttendanceRecord } from '#/features/courses/courses.attendance'
import {
  computeOfferExpiry,
  entriesEligibleForExpiry,
  isOfferExpired,
  isSeatAvailable,
  OFFER_WINDOW_MS,
  pickNextToOffer,
  validateTransition,
  waitlistPosition,
} from '#/features/courses/courses.waitlist'
import type { WaitlistEntry } from '#/features/courses/courses.waitlist'

// ── Attendance reconciliation ──────────────────────────────────────────────

const providerRecord: AttendanceRecord = {
  sessionId: 's1',
  userId: 'u1',
  status: 'present',
  source: 'provider',
  markedBy: null,
  markedAt: 0,
}

const manualRecord: AttendanceRecord = {
  sessionId: 's1',
  userId: 'u1',
  status: 'late',
  source: 'manual',
  markedBy: 'admin-1',
  markedAt: 1000,
}

describe('reconcileAttendance', () => {
  test('provider_only when only provider record exists', () => {
    const result = reconcileAttendance(providerRecord, null)
    expect(result.kind).toBe('provider_only')
  })

  test('manual_only when only manual record exists', () => {
    const result = reconcileAttendance(null, manualRecord)
    expect(result.kind).toBe('manual_only')
  })

  test('both_agree when both exist and statuses match', () => {
    const result = reconcileAttendance(
      { ...providerRecord, status: 'present' },
      { ...manualRecord, status: 'present' },
    )
    expect(result.kind).toBe('both_agree')
  })

  test('both_disagree when statuses differ (flagged for review)', () => {
    const result = reconcileAttendance(providerRecord, manualRecord)
    expect(result.kind).toBe('both_disagree')
    if (result.kind === 'both_disagree') {
      expect(result.flaggedForReview).toBe(true)
    }
  })

  test('neither when both null', () => {
    const result = reconcileAttendance(null, null)
    expect(result.kind).toBe('neither')
  })
})

describe('effectiveStatus (provider is source of truth)', () => {
  test('provider wins when both disagree', () => {
    const result = reconcileAttendance(providerRecord, manualRecord)
    expect(effectiveStatus(result)).toBe('present') // provider's status
  })

  test('manual status when only manual exists', () => {
    const result = reconcileAttendance(null, manualRecord)
    expect(effectiveStatus(result)).toBe('late')
  })

  test('null when neither exists', () => {
    const result = reconcileAttendance(null, null)
    expect(effectiveStatus(result)).toBeNull()
  })
})

describe('canApplyManualOverride', () => {
  test('true for manual_only', () => {
    expect(canApplyManualOverride(reconcileAttendance(null, manualRecord))).toBe(true)
  })

  test('true for both_disagree (flagged for review)', () => {
    expect(canApplyManualOverride(reconcileAttendance(providerRecord, manualRecord))).toBe(true)
  })

  test('false for provider_only', () => {
    expect(canApplyManualOverride(reconcileAttendance(providerRecord, null))).toBe(false)
  })
})

describe('summarizeAttendance', () => {
  test('counts present/late/absent/notMarked', () => {
    const reconciled = [
      reconcileAttendance({ ...providerRecord, userId: 'u1', status: 'present' }, null),
      reconcileAttendance({ ...providerRecord, userId: 'u2', status: 'late' }, null),
      reconcileAttendance({ ...providerRecord, userId: 'u3', status: 'absent' }, null),
      reconcileAttendance(null, null), // u4 not marked
    ]
    const summary = summarizeAttendance(reconciled, 5)
    expect(summary.present).toBe(1)
    expect(summary.late).toBe(1)
    expect(summary.absent).toBe(1)
    expect(summary.notMarked).toBe(2) // 1 not marked + (5 - 4 marked)
    expect(summary.total).toBe(5)
  })
})

// ── Waitlist lifecycle ─────────────────────────────────────────────────────

describe('validateTransition', () => {
  test('waiting -> offered is valid', () => {
    expect(validateTransition('waiting', 'offered').valid).toBe(true)
  })

  test('offered -> enrolled is valid', () => {
    expect(validateTransition('offered', 'enrolled').valid).toBe(true)
  })

  test('enrolled -> waiting is invalid (terminal state)', () => {
    const result = validateTransition('enrolled', 'waiting')
    expect(result.valid).toBe(false)
  })

  test('expired -> offered is invalid (terminal state)', () => {
    const result = validateTransition('expired', 'offered')
    expect(result.valid).toBe(false)
  })

  test('same status is invalid (no change)', () => {
    expect(validateTransition('waiting', 'waiting').valid).toBe(false)
  })
})

describe('computeOfferExpiry', () => {
  test('offer expires 72 hours after offeredAt', () => {
    const offeredAt = 1000
    const expiresAt = computeOfferExpiry(offeredAt)
    expect(expiresAt - offeredAt).toBe(OFFER_WINDOW_MS)
    expect(expiresAt - offeredAt).toBe(72 * 60 * 60 * 1000)
  })
})

describe('isOfferExpired', () => {
  test('true when now >= expiresAt', () => {
    const entry: WaitlistEntry = {
      id: 'w1',
      status: 'offered',
      requestedAt: 0,
      offeredAt: 1000,
      expiresAt: 2000,
      enrolledAt: null,
    }
    expect(isOfferExpired(entry, 2000)).toBe(true)
    expect(isOfferExpired(entry, 1999)).toBe(false)
  })

  test('false when status is not offered', () => {
    const entry: WaitlistEntry = {
      id: 'w1',
      status: 'waiting',
      requestedAt: 0,
      offeredAt: null,
      expiresAt: null,
      enrolledAt: null,
    }
    expect(isOfferExpired(entry, 9999)).toBe(false)
  })
})

describe('isSeatAvailable', () => {
  test('true when current < capacity', () => {
    expect(isSeatAvailable(8, 10)).toBe(true)
  })
  test('false when current === capacity', () => {
    expect(isSeatAvailable(10, 10)).toBe(false)
  })
  test('false when current > capacity (over-enrolled)', () => {
    expect(isSeatAvailable(11, 10)).toBe(false)
  })
})

describe('pickNextToOffer', () => {
  test('returns the oldest waiting entry (FIFO)', () => {
    const entries: WaitlistEntry[] = [
      {
        id: 'w2',
        status: 'waiting',
        requestedAt: 2000,
        offeredAt: null,
        expiresAt: null,
        enrolledAt: null,
      },
      {
        id: 'w1',
        status: 'waiting',
        requestedAt: 1000,
        offeredAt: null,
        expiresAt: null,
        enrolledAt: null,
      },
      {
        id: 'w3',
        status: 'offered',
        requestedAt: 500,
        offeredAt: 600,
        expiresAt: 700,
        enrolledAt: null,
      },
    ]
    const next = pickNextToOffer(entries)
    expect(next?.id).toBe('w1')
  })

  test('returns null when no waiting entries', () => {
    const entries: WaitlistEntry[] = [
      {
        id: 'w1',
        status: 'offered',
        requestedAt: 1000,
        offeredAt: 1100,
        expiresAt: 1200,
        enrolledAt: null,
      },
    ]
    expect(pickNextToOffer(entries)).toBeNull()
  })
})

describe('waitlistPosition', () => {
  const entries: WaitlistEntry[] = [
    {
      id: 'w2',
      status: 'waiting',
      requestedAt: 2000,
      offeredAt: null,
      expiresAt: null,
      enrolledAt: null,
    },
    {
      id: 'w1',
      status: 'waiting',
      requestedAt: 1000,
      offeredAt: null,
      expiresAt: null,
      enrolledAt: null,
    },
    {
      id: 'w3',
      status: 'waiting',
      requestedAt: 3000,
      offeredAt: null,
      expiresAt: null,
      enrolledAt: null,
    },
  ]

  test('1-indexed position by FIFO order', () => {
    expect(waitlistPosition(entries, 'w1')).toBe(1)
    expect(waitlistPosition(entries, 'w2')).toBe(2)
    expect(waitlistPosition(entries, 'w3')).toBe(3)
  })

  test('null for non-waiting entry', () => {
    const nonWaiting: WaitlistEntry[] = [
      {
        id: 'w1',
        status: 'offered',
        requestedAt: 1000,
        offeredAt: 1100,
        expiresAt: 1200,
        enrolledAt: null,
      },
    ]
    expect(waitlistPosition(nonWaiting, 'w1')).toBeNull()
  })
})

describe('entriesEligibleForExpiry', () => {
  test('filters to offered entries past expiry', () => {
    const entries: WaitlistEntry[] = [
      {
        id: 'fresh',
        status: 'offered',
        requestedAt: 0,
        offeredAt: 1000,
        expiresAt: 9999,
        enrolledAt: null,
      },
      {
        id: 'expired',
        status: 'offered',
        requestedAt: 0,
        offeredAt: 1000,
        expiresAt: 1000,
        enrolledAt: null,
      },
    ]
    const eligible = entriesEligibleForExpiry(entries, 2000)
    expect(eligible.map((e) => e.id)).toEqual(['expired'])
  })
})
