import { describe, expect, test } from 'bun:test'
import {
  buildCoursePerformanceSection,
  buildCohortComparisonSections,
  buildFunnelSection,
  buildQuizSection,
  buildStudentProgressSection,
  buildTrendSection,
} from '../src/features/analytics/analytics.export-rows'
import type { CohortComparison } from '../src/features/analytics/analytics.types'

describe('buildCoursePerformanceSection', () => {
  test('includes a Revenue column only when revenue data exists', () => {
    const withRevenue = buildCoursePerformanceSection([
      {
        title: 'TOEFL',
        students: 10,
        completionPct: 68,
        avgRating: 4.8,
        avgTimeHours: 12.4,
        revenue: 5000,
      },
    ])
    expect(withRevenue.columns).toContain('Revenue')
    expect(withRevenue.rows[0]).toContain(5000)

    const withoutRevenue = buildCoursePerformanceSection([
      {
        title: 'TOEFL',
        students: 10,
        completionPct: 68,
        avgRating: 4.8,
        avgTimeHours: 12.4,
        revenue: null,
      },
    ])
    expect(withoutRevenue.columns).not.toContain('Revenue')
  })

  test('empty selection produces a section with headers only', () => {
    const section = buildCoursePerformanceSection([])
    expect(section.rows).toEqual([])
    expect(section.columns.length).toBeGreaterThan(0)
  })
})

describe('buildStudentProgressSection', () => {
  test('maps progress rows with completion flags', () => {
    const section = buildStudentProgressSection([
      {
        course: 'TOEFL',
        student: 'Abe (abe@example.com)',
        progressPct: 45.5,
        isCompleted: false,
        completedAt: null,
        lastAccessedAt: '2026-01-10T00:00:00.000Z',
      },
      {
        course: 'TOEFL',
        student: 'Beth (beth@example.com)',
        progressPct: 100,
        isCompleted: true,
        completedAt: '2026-01-09T00:00:00.000Z',
        lastAccessedAt: '2026-01-09T00:00:00.000Z',
      },
    ])
    expect(section.rows).toHaveLength(2)
    expect(section.rows[1]).toEqual([
      'TOEFL',
      'Beth (beth@example.com)',
      100,
      'Yes',
      '2026-01-09T00:00:00.000Z',
      '2026-01-09T00:00:00.000Z',
    ])
  })
})

describe('buildQuizSection', () => {
  test('null aggregates stay null for empty quizzes', () => {
    const section = buildQuizSection([
      { course: 'TOEFL', quiz: 'Reading Check', attempts: 0, avgScorePct: null, passRatePct: null },
    ])
    expect(section.rows[0]).toEqual(['TOEFL', 'Reading Check', 0, null, null])
  })
})

describe('buildFunnelSection', () => {
  test('renders flagged steps with a marker (PDF sanitizes to ASCII)', () => {
    const section = buildFunnelSection('TOEFL', [
      { label: 'Enrolled', count: 100, pctOfEnrolled: 100, declinePts: 0, flagged: false },
      { label: 'Module 1', count: 70, pctOfEnrolled: 70, declinePts: 30, flagged: true },
    ])
    expect(section.rows[1]).toEqual(['Module 1', 70, 70, 30, '⚠'])
    expect(section.title).toContain('TOEFL')
  })
})

describe('buildCohortComparisonSections', () => {
  test('member counts ride along with metric rows', () => {
    const comparison: CohortComparison = {
      columns: [
        {
          cohortId: 'c1',
          name: 'Jan',
          memberCount: 3,
          avgCompletionPct: 60,
          avgQuizScorePct: 70,
          avgWeeksToFinish: 6,
        },
        {
          cohortId: 'c2',
          name: 'Apr',
          memberCount: 4,
          avgCompletionPct: 70,
          avgQuizScorePct: 65,
          avgWeeksToFinish: 5,
        },
      ],
      rows: [
        {
          metric: 'completion',
          label: 'Avg. Completion',
          betterDirection: 'higher',
          values: [60, 70],
          arrows: [null, true],
        },
      ],
      isEmpty: false,
    }
    const sections = buildCohortComparisonSections(comparison)
    expect(sections).toHaveLength(1)
    expect(sections[0].rows[0]).toEqual(['Members', 3, 4])
    expect(sections[0].rows[1]).toEqual(['Avg. Completion', 60, 70])
  })
})

describe('buildTrendSection', () => {
  test('maps trend points with a unit column', () => {
    const section = buildTrendSection(
      'Completion Rate',
      [{ date: '2026-01-02T00:00:00.000Z', value: 40 }],
      'Rate %',
    )
    expect(section.columns).toEqual(['Bucket', 'Rate %'])
    expect(section.rows).toEqual([['2026-01-02T00:00:00.000Z', 40]])
  })
})
