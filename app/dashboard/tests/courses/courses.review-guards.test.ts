import { describe, expect, test } from 'bun:test'
import {
  canApprove,
  canReassign,
  checkSelfApproval,
  checkStaleSubmission,
  requiresComment,
  staleApprovalReason,
  validateBulkReviewBatch,
} from '#/features/courses/courses.review-guards'
import type { BulkReviewItem } from '#/features/courses/courses.review-guards'

describe('requiresComment', () => {
  test('approve does not require a comment', () => {
    expect(requiresComment('approve')).toBe(false)
  })
  test('request_changes requires a comment', () => {
    expect(requiresComment('request_changes')).toBe(true)
  })
  test('reject requires a comment', () => {
    expect(requiresComment('reject')).toBe(true)
  })
})

describe('checkStaleSubmission', () => {
  test('fresh when submittedVersion === currentVersion', () => {
    expect(checkStaleSubmission({ submittedVersion: 3, currentVersion: 3 })).toEqual({
      kind: 'fresh',
    })
  })

  test('stale when submittedVersion < currentVersion', () => {
    const result = checkStaleSubmission({ submittedVersion: 2, currentVersion: 5 })
    expect(result.kind).toBe('stale')
    if (result.kind === 'stale') {
      expect(result.submittedVersion).toBe(2)
      expect(result.currentVersion).toBe(5)
    }
  })
})

describe('canApprove', () => {
  test('true when fresh', () => {
    expect(canApprove({ kind: 'fresh' })).toBe(true)
  })
  test('false when stale', () => {
    expect(canApprove({ kind: 'stale', submittedVersion: 2, currentVersion: 5 })).toBe(false)
  })
})

describe('staleApprovalReason', () => {
  test('null when fresh', () => {
    expect(staleApprovalReason({ kind: 'fresh' })).toBeNull()
  })
  test('includes both versions when stale', () => {
    const reason = staleApprovalReason({
      kind: 'stale',
      submittedVersion: 2,
      currentVersion: 5,
    })
    expect(reason).toContain('v5')
    expect(reason).toContain('v2')
  })
})

describe('checkSelfApproval', () => {
  test('can_review when current user is not the author', () => {
    const result = checkSelfApproval({
      authorId: 'user-1',
      currentUserId: 'user-2',
      availableReviewers: ['user-2', 'user-3'],
    })
    expect(result.kind).toBe('can_review')
  })

  test('self_authored when current user is the author (other reviewers exist)', () => {
    const result = checkSelfApproval({
      authorId: 'user-1',
      currentUserId: 'user-1',
      availableReviewers: ['user-1', 'user-2'],
    })
    expect(result.kind).toBe('self_authored')
    if (result.kind === 'self_authored') {
      expect(result.reason).toContain("can't approve your own")
    }
  })

  test('sole_reviewer when author is the only available reviewer', () => {
    const result = checkSelfApproval({
      authorId: 'user-1',
      currentUserId: 'user-1',
      availableReviewers: ['user-1'],
    })
    expect(result.kind).toBe('sole_reviewer')
    if (result.kind === 'sole_reviewer') {
      expect(result.reason).toBe('Yours — awaiting another reviewer')
    }
  })
})

describe('canReassign', () => {
  test('true for self_authored', () => {
    expect(canReassign({ kind: 'self_authored', reason: 'x' })).toBe(true)
  })
  test('true for sole_reviewer', () => {
    expect(canReassign({ kind: 'sole_reviewer', reason: 'x', reassignable: false })).toBe(true)
  })
  test('false for can_review', () => {
    expect(canReassign({ kind: 'can_review' })).toBe(false)
  })
})

describe('validateBulkReviewBatch', () => {
  const freshItem = (id: string): BulkReviewItem => ({
    submissionId: id,
    decision: 'approve',
    comment: null,
    staleState: { kind: 'fresh' },
    selfApprovalState: { kind: 'can_review' },
  })

  test('rejects empty batch', () => {
    const result = validateBulkReviewBatch([])
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('No submissions')
  })

  test('rejects mixed decisions', () => {
    const items: BulkReviewItem[] = [
      { ...freshItem('s1'), decision: 'approve' },
      { ...freshItem('s2'), decision: 'request_changes' },
    ]
    const result = validateBulkReviewBatch(items)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('single decision')
  })

  test('rejects bulk-reject (never bulk-reject)', () => {
    const items: BulkReviewItem[] = [
      { ...freshItem('s1'), decision: 'reject' },
      { ...freshItem('s2'), decision: 'reject' },
    ]
    const result = validateBulkReviewBatch(items)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Bulk-reject is not supported')
  })

  test('valid batch of approves — all decided', () => {
    const items: BulkReviewItem[] = [freshItem('s1'), freshItem('s2'), freshItem('s3')]
    const result = validateBulkReviewBatch(items)
    expect(result.valid).toBe(true)
    expect(result.outcomes.every((o) => o.outcome === 'decided')).toBe(true)
  })

  test('skips stale submissions', () => {
    const items: BulkReviewItem[] = [
      freshItem('s1'),
      {
        ...freshItem('s2'),
        staleState: { kind: 'stale', submittedVersion: 1, currentVersion: 3 },
      },
    ]
    const result = validateBulkReviewBatch(items)
    expect(result.valid).toBe(true)
    const stale = result.outcomes.find((o) => o.submissionId === 's2')
    expect(stale?.outcome).toBe('skipped_stale')
  })

  test('skips self-authored submissions', () => {
    const items: BulkReviewItem[] = [
      freshItem('s1'),
      {
        ...freshItem('s2'),
        selfApprovalState: { kind: 'self_authored', reason: "can't approve your own" },
      },
    ]
    const result = validateBulkReviewBatch(items)
    expect(result.valid).toBe(true)
    const self = result.outcomes.find((o) => o.submissionId === 's2')
    expect(self?.outcome).toBe('skipped_self')
  })
})
