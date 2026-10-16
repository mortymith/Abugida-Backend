import { describe, expect, test } from 'bun:test'
import {
  canDeletePermanently,
  computeDeleteImpact,
  detachConfirmationMessage,
  impactStatement,
} from '#/features/media/media.delete-impact'
import type { AssetUsageEntry } from '#/features/media/media.delete-impact'

const usage: AssetUsageEntry[] = [
  {
    itemId: 'i1',
    courseId: 'c1',
    courseName: 'TOEFL Complete',
    courseStatus: 'published',
    itemName: 'What is TOEFL?',
    enrolledStudentCount: 120,
  },
  {
    itemId: 'i2',
    courseId: 'c1',
    courseName: 'TOEFL Complete',
    courseStatus: 'published',
    itemName: 'Skimming',
    enrolledStudentCount: 120,
  },
  {
    itemId: 'i3',
    courseId: 'c2',
    courseName: 'TOEFL Speaking',
    courseStatus: 'published',
    itemName: 'Intro',
    enrolledStudentCount: 114,
  },
  {
    itemId: 'i4',
    courseId: 'c3',
    courseName: 'Archived Course',
    courseStatus: 'archived',
    itemName: 'Old',
    enrolledStudentCount: 0,
  },
]

describe('computeDeleteImpact', () => {
  test('counts distinct items', () => {
    const impact = computeDeleteImpact(usage)
    expect(impact.itemCount).toBe(4)
  })
  test('counts distinct courses', () => {
    const impact = computeDeleteImpact(usage)
    expect(impact.courseCount).toBe(3)
  })
  test('counts published uses', () => {
    const impact = computeDeleteImpact(usage)
    expect(impact.publishedUseCount).toBe(3) // 3 items in published courses
  })
  test('sums affected students across published courses', () => {
    const impact = computeDeleteImpact(usage)
    // c1 (120) + c2 (114) = 234
    expect(impact.affectedStudentCount).toBe(234)
  })
  test('empty usage → zero impact', () => {
    const impact = computeDeleteImpact([])
    expect(impact.itemCount).toBe(0)
    expect(impact.courseCount).toBe(0)
    expect(impact.publishedUseCount).toBe(0)
    expect(impact.affectedStudentCount).toBe(0)
  })
})

describe('impactStatement', () => {
  test('matches the spec example wording', () => {
    const impact = computeDeleteImpact(usage)
    const stmt = impactStatement(impact)
    expect(stmt).toContain('4 items across 3 courses')
    expect(stmt).toContain('3 items are in published courses')
    expect(stmt).toContain('broken image to 234 students')
  })
  test('no usage → not used message', () => {
    const stmt = impactStatement(computeDeleteImpact([]))
    expect(stmt).toContain('not used in any course')
  })
  test('no published uses → no student impact', () => {
    const archivedOnly: AssetUsageEntry[] = [
      {
        itemId: 'i1',
        courseId: 'c1',
        courseName: 'Archived',
        courseStatus: 'archived',
        itemName: 'Old',
        enrolledStudentCount: 0,
      },
    ]
    const stmt = impactStatement(computeDeleteImpact(archivedOnly))
    expect(stmt).toContain('not affect any live course')
  })
})

describe('canDeletePermanently', () => {
  const impact = computeDeleteImpact(usage)
  test('false when in use and not archived/detached/acknowledged', () => {
    expect(
      canDeletePermanently(impact, {
        archived: false,
        detached: false,
        acknowledgedBreakage: false,
      }),
    ).toBe(false)
  })
  test('true when archived', () => {
    expect(
      canDeletePermanently(impact, {
        archived: true,
        detached: false,
        acknowledgedBreakage: false,
      }),
    ).toBe(true)
  })
  test('true when detached', () => {
    expect(
      canDeletePermanently(impact, {
        archived: false,
        detached: true,
        acknowledgedBreakage: false,
      }),
    ).toBe(true)
  })
  test('true when acknowledged', () => {
    expect(
      canDeletePermanently(impact, {
        archived: false,
        detached: false,
        acknowledgedBreakage: true,
      }),
    ).toBe(true)
  })
  test('true when not in use', () => {
    expect(
      canDeletePermanently(computeDeleteImpact([]), {
        archived: false,
        detached: false,
        acknowledgedBreakage: false,
      }),
    ).toBe(true)
  })
})

describe('detachConfirmationMessage', () => {
  test('names the item count', () => {
    const msg = detachConfirmationMessage(computeDeleteImpact(usage))
    expect(msg).toContain('4 items')
    expect(msg).toContain('missing-media placeholder')
  })
  test('not attached when no usage', () => {
    const msg = detachConfirmationMessage(computeDeleteImpact([]))
    expect(msg).toContain('not attached')
  })
})
