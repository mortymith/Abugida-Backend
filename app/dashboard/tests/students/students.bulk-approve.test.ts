import { describe, expect, test } from 'bun:test'
import {
  bulkApproveConfirmationMessage,
  computeBulkApproveExclusions,
  capacityRaceMessage,
  courseFullMessage,
  EXCLUSION_REASON_LABELS,
  resolveCapacityRace,
} from '#/features/students/students.bulk-approve'
import type { EnrollmentRequestCandidate } from '#/features/students/students.bulk-approve'

const candidates: Array<EnrollmentRequestCandidate & { requestedAt: number }> = [
  {
    requestId: 'r1',
    studentId: 's1',
    studentName: 'Sara B.',
    courseId: 'c1',
    courseName: 'IELTS',
    cohortId: null,
    requestedAt: 1000,
  },
  {
    requestId: 'r2',
    studentId: 's2',
    studentName: 'Daniel W.',
    courseId: 'c1',
    courseName: 'IELTS',
    cohortId: null,
    requestedAt: 2000,
  },
  {
    requestId: 'r3',
    studentId: 's3',
    studentName: 'Tigist M.',
    courseId: 'c1',
    courseName: 'IELTS',
    cohortId: null,
    requestedAt: 3000,
  },
]

describe('EXCLUSION_REASON_LABELS', () => {
  test('6 exclusion reasons', () => {
    expect(Object.keys(EXCLUSION_REASON_LABELS)).toHaveLength(6)
  })
})

describe('computeBulkApproveExclusions', () => {
  test('all approved when no exclusions', () => {
    const plan = computeBulkApproveExclusions(candidates, {
      enrolledStudentIds: new Set(),
      unpublishedCourseIds: new Set(),
      archivedCohortIds: new Set(),
      withdrawnConsentStudentIds: new Set(),
      courseCapacity: 100,
      currentEnrollmentCount: 10,
    })
    expect(plan.toApprove).toHaveLength(3)
    expect(plan.excluded).toHaveLength(0)
    expect(plan.finalCount).toBe(3)
  })

  test('excludes already enrolled', () => {
    const plan = computeBulkApproveExclusions(candidates, {
      enrolledStudentIds: new Set(['s1']),
      unpublishedCourseIds: new Set(),
      archivedCohortIds: new Set(),
      withdrawnConsentStudentIds: new Set(),
      courseCapacity: 100,
      currentEnrollmentCount: 10,
    })
    expect(plan.toApprove).toHaveLength(2)
    expect(plan.excluded).toHaveLength(1)
    expect(plan.excluded[0].reason).toBe('already_enrolled')
  })

  test('excludes unpublished course', () => {
    const plan = computeBulkApproveExclusions(candidates, {
      enrolledStudentIds: new Set(),
      unpublishedCourseIds: new Set(['c1']),
      archivedCohortIds: new Set(),
      withdrawnConsentStudentIds: new Set(),
      courseCapacity: 100,
      currentEnrollmentCount: 10,
    })
    expect(plan.toApprove).toHaveLength(0)
    expect(plan.excluded).toHaveLength(3)
    expect(plan.excluded.every((e) => e.reason === 'course_unpublished')).toBe(true)
  })

  test('capacity check: 1 seat, 3 requests → 1 approved, 2 excluded as course_full', () => {
    const plan = computeBulkApproveExclusions(candidates, {
      enrolledStudentIds: new Set(),
      unpublishedCourseIds: new Set(),
      archivedCohortIds: new Set(),
      withdrawnConsentStudentIds: new Set(),
      courseCapacity: 11,
      currentEnrollmentCount: 10, // 1 seat left
    })
    expect(plan.toApprove).toHaveLength(1)
    expect(plan.excluded).toHaveLength(2)
    expect(plan.excluded.every((e) => e.reason === 'course_full')).toBe(true)
  })
})

describe('bulkApproveConfirmationMessage', () => {
  test('all approved, no exclusions', () => {
    const plan = computeBulkApproveExclusions(candidates, {
      enrolledStudentIds: new Set(),
      unpublishedCourseIds: new Set(),
      archivedCohortIds: new Set(),
      withdrawnConsentStudentIds: new Set(),
      courseCapacity: 100,
      currentEnrollmentCount: 10,
    })
    const msg = bulkApproveConfirmationMessage(plan)
    expect(msg).toContain('Approve 3 requests')
    expect(msg).toContain('3 will be enrolled')
  })

  test('with exclusions names the excluded student', () => {
    const plan = computeBulkApproveExclusions(candidates, {
      enrolledStudentIds: new Set(['s1']),
      unpublishedCourseIds: new Set(),
      archivedCohortIds: new Set(),
      withdrawnConsentStudentIds: new Set(),
      courseCapacity: 100,
      currentEnrollmentCount: 10,
    })
    const msg = bulkApproveConfirmationMessage(plan)
    expect(msg).toContain('1 skipped')
    expect(msg).toContain('Sara B.')
    expect(msg).toContain('already enrolled')
  })
})

describe('resolveCapacityRace', () => {
  test('first-come wins, rest move to waitlist in order', () => {
    const result = resolveCapacityRace(candidates)
    expect(result.admitted.studentId).toBe('s1') // earliest requestedAt
    expect(result.movedToWaitlist).toHaveLength(2)
    expect(result.movedToWaitlist[0].request.studentId).toBe('s2')
    expect(result.movedToWaitlist[0].position).toBe(1)
    expect(result.movedToWaitlist[1].request.studentId).toBe('s3')
    expect(result.movedToWaitlist[1].position).toBe(2)
  })

  test('throws for empty contested list', () => {
    expect(() => resolveCapacityRace([])).toThrow()
  })
})

describe('capacityRaceMessage', () => {
  test('names admitted + moved with positions', () => {
    const result = resolveCapacityRace(candidates)
    const msg = capacityRaceMessage(result)
    expect(msg).toContain('3 students')
    expect(msg).toContain('1 was admitted')
    expect(msg).toContain('Sara B.')
    expect(msg).toContain('2 moved to the waitlist')
    expect(msg).toContain('Daniel W.')
    expect(msg).toContain('Tigist M.')
  })
})

describe('courseFullMessage', () => {
  test('names course + capacity', () => {
    expect(courseFullMessage('IELTS Advanced', 24, 24)).toBe(
      'IELTS Advanced is full (24/24). Approve anyway to add to the waitlist?',
    )
  })
})
