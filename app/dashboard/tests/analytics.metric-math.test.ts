import { describe, expect, test } from 'bun:test'
import {
  QUESTION_FLAG_THRESHOLD_PCT,
  FUNNEL_FLAG_THRESHOLD_PTS,
  averageHoursPerStudent,
  bucketEndsUTC,
  buildCohortComparisonRows,
  buildCompletionTrend,
  buildDistribution,
  buildFunnelSteps,
  buildModuleRows,
  buildQuestionRows,
  buildQuizSummary,
  buildWeekdayActivity,
  findBiggestDrop,
  pctDelta,
  selectLikelyCause,
} from '../src/features/analytics/analytics.metric-math'
import type { LessonEngagementRow } from '../src/features/analytics/analytics.types'

describe('pctDelta', () => {
  test('computes percentage change', () => {
    expect(pctDelta(110, 100)).toBeCloseTo(10)
  })
  test('negative change', () => {
    expect(pctDelta(90, 100)).toBeCloseTo(-10)
  })
  test('null when previous is zero', () => {
    expect(pctDelta(10, 0)).toBeNull()
  })
})

describe('bucketEndsUTC', () => {
  test('daily buckets align to UTC midnight', () => {
    const from = new Date('2026-01-01T00:00:00Z')
    const to = new Date('2026-01-04T00:00:00Z')
    const ends = bucketEndsUTC(from, to, 'day')
    expect(ends).toHaveLength(3)
    expect(ends[0].toISOString()).toBe('2026-01-02T00:00:00.000Z')
  })

  test('weekly buckets land on Mondays', () => {
    // 2026-01-01 is a Thursday → first bucket end is Monday Jan 5.
    const from = new Date('2026-01-01T00:00:00Z')
    const to = new Date('2026-01-16T00:00:00Z')
    const ends = bucketEndsUTC(from, to, 'week')
    expect(ends).toHaveLength(2)
    expect(ends[0].toISOString()).toBe('2026-01-05T00:00:00.000Z')
    expect(ends[1].toISOString()).toBe('2026-01-12T00:00:00.000Z')
  })

  test('monthly buckets land on month starts', () => {
    const from = new Date('2026-01-15T00:00:00Z')
    const to = new Date('2026-03-02T00:00:00Z')
    const ends = bucketEndsUTC(from, to, 'month')
    expect(ends).toHaveLength(2)
    expect(ends[0].toISOString()).toBe('2026-02-01T00:00:00.000Z')
    expect(ends[1].toISOString()).toBe('2026-03-01T00:00:00.000Z')
  })
})

describe('buildCompletionTrend', () => {
  test('cumulative rate includes pre-range bases', () => {
    const from = new Date('2026-01-01T00:00:00Z')
    const to = new Date('2026-01-03T00:00:00Z')
    const points = buildCompletionTrend(from, to, 'day', {
      baseCreated: 9,
      baseCompleted: 4,
      createdAts: [new Date('2026-01-01T06:00:00Z')],
      completedAts: [new Date('2026-01-02T10:00:00Z')],
    })
    // Bucket end Jan 2: 10 enrolled, 4 completed → 40%.
    expect(points[0]).toEqual({ date: '2026-01-02T00:00:00.000Z', value: 40 })
    // Bucket end Jan 3: 10 enrolled, 5 completed → 50%.
    expect(points[1]).toEqual({ date: '2026-01-03T00:00:00.000Z', value: 50 })
  })

  test('buckets before any enrollment produce no point', () => {
    const from = new Date('2026-01-01T00:00:00Z')
    const to = new Date('2026-01-03T00:00:00Z')
    const points = buildCompletionTrend(from, to, 'day', {
      baseCreated: 0,
      baseCompleted: 0,
      createdAts: [new Date('2026-01-02T06:00:00Z')],
      completedAts: [],
    })
    // Jan 2 end: nobody enrolled yet → skipped. Jan 3 end: 1 enrolled → 0%.
    expect(points).toEqual([{ date: '2026-01-03T00:00:00.000Z', value: 0 }])
  })

  test('empty dataset → empty series', () => {
    const points = buildCompletionTrend(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-02T00:00:00Z'),
      'day',
      { baseCreated: 0, baseCompleted: 0, createdAts: [], completedAts: [] },
    )
    expect(points).toEqual([])
  })
})

describe('averageHoursPerStudent', () => {
  test('converts seconds to hours per student', () => {
    expect(averageHoursPerStudent(7200, 2)).toBe(1)
  })
  test('null without students', () => {
    expect(averageHoursPerStudent(3600, 0)).toBeNull()
  })
})

describe('buildWeekdayActivity', () => {
  test('distinct students per ISO weekday, Sunday = 7', () => {
    const points = buildWeekdayActivity([
      // 2026-01-05 is a Monday, 2026-01-11 a Sunday.
      { studentId: 'a', at: new Date('2026-01-05T10:00:00Z') },
      { studentId: 'a', at: new Date('2026-01-05T12:00:00Z') }, // duplicate collapses
      { studentId: 'b', at: new Date('2026-01-06T10:00:00Z') },
      { studentId: 'c', at: new Date('2026-01-11T10:00:00Z') },
    ])
    expect(points).toHaveLength(7)
    expect(points[0]).toEqual({ weekday: 1, students: 1 }) // Mon
    expect(points[1]).toEqual({ weekday: 2, students: 1 }) // Tue
    expect(points[5]).toEqual({ weekday: 6, students: 0 }) // Sat
    expect(points[6]).toEqual({ weekday: 7, students: 1 }) // Sun
  })
})

describe('buildModuleRows', () => {
  test('drop-off chains off the previous module and rounds', () => {
    const rows = buildModuleRows(
      [
        {
          moduleId: 'm1',
          title: 'Intro',
          lessonCount: 2,
          completedStudents: 94,
          avgScorePct: 85,
          quizzes: [],
        },
        {
          moduleId: 'm2',
          title: 'Reading',
          lessonCount: 3,
          completedStudents: 72,
          avgScorePct: 68,
          quizzes: [],
        },
      ],
      100,
    )
    expect(rows[0].completionPct).toBe(94)
    expect(rows[0].dropOffPts).toBe(6)
    expect(rows[1].completionPct).toBe(72)
    expect(rows[1].dropOffPts).toBe(22)
  })

  test('module without lessons yields null percentages', () => {
    const rows = buildModuleRows(
      [
        {
          moduleId: 'm1',
          title: 'Empty',
          lessonCount: 0,
          completedStudents: 0,
          avgScorePct: null,
          quizzes: [],
        },
      ],
      10,
    )
    expect(rows[0].completionPct).toBeNull()
    expect(rows[0].dropOffPts).toBeNull()
  })
})

describe('buildFunnelSteps', () => {
  test('flags declines beyond the 20-point threshold', () => {
    const steps = buildFunnelSteps(
      100,
      [
        { label: 'Module 1', count: 90 },
        { label: 'Module 2', count: 60 }, // 30-pt decline → flagged
      ],
      40,
    )
    expect(steps[0].flagged).toBe(false)
    expect(steps[1].declinePts).toBe(10) // Module 1
    expect(steps[1].flagged).toBe(false)
    expect(steps[2].declinePts).toBe(30) // Module 2 → flagged
    expect(steps[2].flagged).toBe(true)
    expect(steps[3].declinePts).toBe(20) // Completed
    expect(steps[3].flagged).toBe(false) // exactly 20 is not greater than 20
  })

  test('strictly greater than threshold flags', () => {
    const steps = buildFunnelSteps(100, [{ label: 'Module 1', count: 79 }], 79)
    expect(steps[1].declinePts).toBe(21)
    expect(steps[1].flagged).toBe(true)
  })

  test('threshold constant matches spec', () => {
    expect(FUNNEL_FLAG_THRESHOLD_PTS).toBe(20)
  })
})

describe('findBiggestDrop', () => {
  test('picks the steepest decline', () => {
    const steps = buildFunnelSteps(
      100,
      [
        { label: 'M1', count: 90 },
        { label: 'M2', count: 80 },
        { label: 'M3', count: 40 },
      ],
      30,
    )
    const drop = findBiggestDrop(steps)
    expect(drop).toEqual({ fromLabel: 'M2', toLabel: 'M3', declinePts: 40 })
  })

  test('Enrolled→Completed with zero decline yields a zero drop', () => {
    const steps = buildFunnelSteps(100, [], 100)
    expect(findBiggestDrop(steps)).toEqual({
      fromLabel: 'Enrolled',
      toLabel: 'Completed',
      declinePts: 0,
    })
  })
})

describe('selectLikelyCause', () => {
  const lessons: LessonEngagementRow[] = [
    { lessonId: 'l1', title: 'A', avgWatchPct: 40, completions: 10 },
    { lessonId: 'l2', title: 'B', avgWatchPct: 18, completions: 30 },
    { lessonId: 'l3', title: 'C', avgWatchPct: 60, completions: 2 },
  ]

  test('lowest watch ratio wins when durations exist', () => {
    expect(selectLikelyCause(lessons)!.lessonId).toBe('l2')
  })

  test('falls back to completion count without ratios', () => {
    const withoutRatios = lessons.map((lesson) => ({ ...lesson, avgWatchPct: null }))
    expect(selectLikelyCause(withoutRatios)!.lessonId).toBe('l3')
  })
})

describe('buildQuizSummary', () => {
  test('attempts, avg score, pass rate', () => {
    const summary = buildQuizSummary([
      { scorePct: 80, isPassed: true },
      { scorePct: 60, isPassed: false },
      { scorePct: 100, isPassed: true },
    ])
    expect(summary.attempts).toBe(3)
    expect(summary.avgScorePct).toBe(80)
    expect(summary.passRatePct).toBeCloseTo(66.67)
  })

  test('empty → nulls with zero attempts', () => {
    expect(buildQuizSummary([])).toEqual({ attempts: 0, avgScorePct: null, passRatePct: null })
  })
})

describe('buildQuestionRows', () => {
  test('correct %, per-answer timing, and distribution', () => {
    const rows = buildQuestionRows(
      [
        {
          attemptId: 1,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          answers: [
            {
              questionId: 1,
              studentAnswer: 'Paris',
              isCorrect: true,
              answeredAt: new Date('2026-01-01T00:00:30Z'),
            },
            {
              questionId: 2,
              studentAnswer: null,
              isCorrect: false,
              answeredAt: new Date('2026-01-01T00:01:00Z'),
            },
          ],
        },
        {
          attemptId: 2,
          startedAt: new Date('2026-01-01T01:00:00Z'),
          answers: [
            {
              questionId: 1,
              studentAnswer: 'paris',
              isCorrect: true,
              answeredAt: new Date('2026-01-01T01:00:10Z'),
            },
          ],
        },
      ],
      [
        { questionId: 1, prompt: 'Capital of France?', optionTexts: ['Paris', 'Rome'] },
        { questionId: 2, prompt: '2+2?', optionTexts: ['3', '4'] },
      ],
    )

    expect(rows).toHaveLength(2)
    const q1 = rows.find((row) => row.prompt === 'Capital of France?')!
    expect(q1.correctPct).toBe(100)
    expect(q1.avgTimeSeconds).toBe(20) // (30 + 10) / 2
    expect(q1.flagged).toBe(false)
    expect(q1.distribution).toEqual([
      { label: 'Paris', count: 2, pct: 100 },
      { label: 'Rome', count: 0, pct: 0 },
    ])

    const q2 = rows.find((row) => row.prompt === '2+2?')!
    expect(q2.correctPct).toBe(0)
    expect(q2.flagged).toBe(true) // below QUESTION_FLAG_THRESHOLD_PCT (50)
    // Every option gets a row (zero counts included), Unanswered collapses blanks.
    expect(q2.distribution).toContainEqual({ label: 'Unanswered', count: 1, pct: 100 })
    expect(q2.distribution).toContainEqual({ label: '3', count: 0, pct: 0 })
  })

  test('negative timing deltas clamp to zero', () => {
    const rows = buildQuestionRows(
      [
        {
          attemptId: 1,
          startedAt: new Date('2026-01-01T00:01:00Z'),
          answers: [
            {
              questionId: 1,
              studentAnswer: 'x',
              isCorrect: false,
              answeredAt: new Date('2026-01-01T00:00:00Z'),
            },
          ],
        },
      ],
      [{ questionId: 1, prompt: 'Q', optionTexts: [] }],
    )
    expect(rows[0].avgTimeSeconds).toBe(0)
  })

  test('never-answered questions have null stats and no flag', () => {
    const rows = buildQuestionRows([], [{ questionId: 1, prompt: 'Q', optionTexts: ['a'] }])
    expect(rows[0]).toMatchObject({ correctPct: null, avgTimeSeconds: null, flagged: false })
    expect(QUESTION_FLAG_THRESHOLD_PCT).toBe(50)
  })
})

describe('buildDistribution', () => {
  test('matches options case-insensitively under canonical labels', () => {
    const rows = buildDistribution(['paris ', 'PARIS', 'Rome'], ['Paris', 'Rome'])
    expect(rows).toEqual([
      { label: 'Paris', count: 2, pct: expect.closeTo(66.67) },
      { label: 'Rome', count: 1, pct: expect.closeTo(33.33) },
    ])
  })

  test('blanks collapse into Unanswered', () => {
    const rows = buildDistribution(['', null, 'a'], ['a', 'b'])
    expect(rows).toContainEqual({ label: 'Unanswered', count: 2, pct: expect.closeTo(66.67) })
  })

  test('free text keeps its verbatim value', () => {
    const rows = buildDistribution(['the sky'], ['a'])
    expect(rows).toEqual([
      { label: 'the sky', count: 1, pct: 100 },
      { label: 'a', count: 0, pct: 0 },
    ])
  })

  test('empty answers → empty distribution', () => {
    expect(buildDistribution([], ['a'])).toEqual([])
  })
})

describe('buildCohortComparisonRows', () => {
  test('arrows respect the better direction per metric', () => {
    const rows = buildCohortComparisonRows([
      {
        cohortId: 'c1',
        name: 'Jan',
        memberCount: 10,
        avgCompletionPct: 60,
        avgQuizScorePct: 70,
        avgWeeksToFinish: 6,
      },
      {
        cohortId: 'c2',
        name: 'Apr',
        memberCount: 12,
        avgCompletionPct: 70,
        avgQuizScorePct: 65,
        avgWeeksToFinish: 5,
      },
    ])
    const completion = rows.find((row) => row.metric === 'completion')!
    expect(completion.arrows).toEqual([null, true]) // higher is better
    const quiz = rows.find((row) => row.metric === 'quizScore')!
    expect(quiz.arrows).toEqual([null, false])
    const time = rows.find((row) => row.metric === 'timeToFinish')!
    expect(time.arrows).toEqual([null, true]) // lower is better
  })

  test('null on either side yields a null arrow', () => {
    const rows = buildCohortComparisonRows([
      {
        cohortId: 'c1',
        name: 'Jan',
        memberCount: 10,
        avgCompletionPct: null,
        avgQuizScorePct: 70,
        avgWeeksToFinish: 6,
      },
      {
        cohortId: 'c2',
        name: 'Apr',
        memberCount: 12,
        avgCompletionPct: 70,
        avgQuizScorePct: null,
        avgWeeksToFinish: 5,
      },
    ])
    expect(rows.find((row) => row.metric === 'completion')!.arrows).toEqual([null, null])
  })
})
