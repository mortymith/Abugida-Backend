import { describe, expect, test } from 'bun:test'
import {
  canProceedFromCurriculum,
  dedupeTitle,
  normalizeTitle,
  reindexOrder,
  validateCurriculumTree,
} from '#/features/courses/courses.curriculum-tree'
import { detectUnlockCycle, buildLockMessage } from '#/features/courses/courses.unlock-cycle'
import { applyReviewDecision, canSubmitForReview } from '#/features/courses/courses.review-state'
import {
  accessDaysForModel,
  applyBulkDiscount,
  applyEarlyBird,
  buildProductId,
  LIFETIME_ACCESS_DAYS,
} from '#/features/courses/courses.pricing-logic'
import { validateQuizQuestions, trueFalseOptions } from '#/features/courses/courses.quiz-validation'
import {
  localOutline,
  localQuiz,
  stripMarkdown,
  extractTopic,
} from '#/features/courses/courses.ai-local'

describe('curriculum tree (S-2.3)', () => {
  const good = {
    modules: [
      {
        publicId: 'm1',
        title: 'Module One',
        lessons: [{ publicId: 'l1', title: 'Lesson One', modulePublicId: 'm1' }],
      },
    ],
  }

  test('accepts a tree with at least one module and lesson', () => {
    expect(validateCurriculumTree(good).ok).toBe(true)
    expect(canProceedFromCurriculum({ modules: good.modules })).toBe(true)
  })

  test('blocks empty modules/lesson-less trees', () => {
    const result = validateCurriculumTree({
      modules: [{ publicId: 'm1', title: 'Module One', lessons: [] }],
    })
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toContain('at least 1 module with 1 lesson')
  })

  test('requires names of at least 3 characters', () => {
    const result = validateCurriculumTree({
      modules: [
        {
          publicId: 'm1',
          title: 'ab',
          lessons: [{ publicId: 'l1', title: 'x', modulePublicId: 'm1' }],
        },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toContain('3 characters')
  })

  test('normalizes and dedupes titles', () => {
    expect(normalizeTitle('  spaced   out ')).toBe('spaced out')
    expect(dedupeTitle('Drill', ['Drill'])).toBe('Drill (2)')
    expect(dedupeTitle('Drill', ['Drill', 'Drill (2)'])).toBe('Drill (3)')
  })

  test('reindexOrder produces 0..n-1', () => {
    expect(reindexOrder(['a', 'b', 'c']).map((item) => item.sortOrder)).toEqual([0, 1, 2])
  })
})

describe('unlock cycle detection (S-2.15)', () => {
  test('detects direct loops and self-reference', () => {
    expect(
      detectUnlockCycle(
        [{ lessonId: 'a', requiredLessonId: 'b' }],
        [{ lessonId: 'b', requiredLessonId: 'a' }],
      ).ok,
    ).toBe(false)
    expect(detectUnlockCycle([{ lessonId: 'a', requiredLessonId: 'a' }], []).ok).toBe(false)
  })

  test('accepts acyclic chains', () => {
    const result = detectUnlockCycle(
      [{ lessonId: 'c', requiredLessonId: 'b' }],
      [{ lessonId: 'b', requiredLessonId: 'a' }],
    )
    expect(result.ok).toBe(true)
    expect(result.cycle).toEqual([])
  })

  test('builds readable lock messages', () => {
    expect(
      buildLockMessage([
        { lessonTitle: 'Reading Overview', condition: 'viewed', thresholdPercent: null },
        { lessonTitle: 'Reading Check', condition: 'quiz_score', thresholdPercent: 70 },
      ]),
    ).toContain('score 70%+ on Reading Check')
  })
})

describe('review state machine (S-2.14)', () => {
  test('approve only from in_review', () => {
    expect(applyReviewDecision('in_review', 'approve').lessonStatus).toBe('approved')
    expect(() => applyReviewDecision('draft', 'approve')).toThrow()
  })

  test('request_changes and reject transitions', () => {
    expect(applyReviewDecision('in_review', 'request_changes').lessonStatus).toBe(
      'changes_requested',
    )
    expect(applyReviewDecision('in_review', 'reject').lessonStatus).toBe('draft')
  })

  test('submit allowed from draft or changes_requested', () => {
    expect(canSubmitForReview('draft')).toBe(true)
    expect(canSubmitForReview('changes_requested')).toBe(true)
    expect(canSubmitForReview('in_review')).toBe(false)
    expect(canSubmitForReview('approved')).toBe(false)
  })
})

describe('pricing logic (S-2.4)', () => {
  test('subscription periods map to durationDays; one-time is lifetime', () => {
    expect(accessDaysForModel('subscription', 'monthly')).toBe(30)
    expect(accessDaysForModel('subscription', 'annual')).toBe(365)
    expect(accessDaysForModel('one_time', undefined)).toBe(LIFETIME_ACCESS_DAYS)
  })

  test('early bird applies before the deadline only', () => {
    const discount = { percentage: 10, endsAt: '2030-01-01T00:00:00.000Z' }
    expect(applyEarlyBird(100, discount, new Date('2026-01-01'))).toBe(90)
    expect(applyEarlyBird(100, discount, new Date('2031-01-01'))).toBeNull()
    expect(applyEarlyBird(100, null)).toBeNull()
  })

  test('bulk discount applies from the minimum count', () => {
    const discount = { percentage: 15, minEnrollments: 10 }
    expect(applyBulkDiscount(100, discount, 9)).toBeNull()
    expect(applyBulkDiscount(100, discount, 10)).toBe(85)
  })

  test('product ids are stable and capped', () => {
    expect(buildProductId('toefl-complete', 'subscription', 'monthly')).toBe(
      'course-toefl-complete-monthly',
    )
    expect(buildProductId('x'.repeat(300), 'one_time').length).toBeLessThanOrEqual(255)
  })
})

describe('quiz validation (S-2.8)', () => {
  test('blocks questions with zero or multiple correct answers', () => {
    const violations = validateQuizQuestions([
      {
        questionType: 'multiple_choice',
        questionText: 'Pick one',
        options: [
          { optionText: 'A', isCorrect: false },
          { optionText: 'B', isCorrect: false },
        ],
      },
      {
        questionType: 'multiple_choice',
        questionText: 'Pick one',
        options: [
          { optionText: 'A', isCorrect: true },
          { optionText: 'B', isCorrect: true },
        ],
      },
    ])
    expect(violations.length).toBe(2)
  })

  test('true/false needs exactly two options', () => {
    const violations = validateQuizQuestions([
      {
        questionType: 'true_false',
        questionText: 'TF?',
        options: [{ optionText: 'True', isCorrect: true }],
      },
    ])
    expect(violations.length).toBe(1)
    expect(trueFalseOptions().length).toBe(2)
  })
})

describe('local AI generators (S-2.11/S-2.16 fallback)', () => {
  test('outline follows the requested scale and flags lessons needing content', () => {
    const outline = localOutline({
      prompt: 'Create a 6-week grammar foundations course for adult beginners.',
      audience: 'Adult learners',
      level: 'beginner',
      moduleCount: 3,
      lessonsPerModule: 2,
      language: 'English',
      includeQuizSeeds: true,
    })
    expect(outline.modules.length).toBe(3)
    expect(outline.modules[0]?.lessons.length).toBe(2)
    expect(outline.modules[0]?.lessons[0]?.needsContent).toBe(true)
    expect(outline.modules[0]?.lessons[1]?.quizSeed).toBeTruthy()
  })

  test('extracts a usable topic from imperative prompts', () => {
    expect(extractTopic('Create a 12-week TOEFL preparation course for beginners.')).toContain(
      'TOEFL preparation',
    )
  })

  test('quiz synthesis marks exactly one correct option', () => {
    const body =
      'Skimming is reading quickly for the general idea of a text. Scanning targets specific details. ' +
      'Prediction uses headings to guess content. Rereading slows you down. Practice under timed conditions matters.'
    const questions = localQuiz(body, {
      questionCount: 3,
      types: ['true_false'],
      difficulty: 'mixed',
    })
    expect(questions.length).toBeGreaterThan(0)
    for (const question of questions) {
      const correct = question.options.filter((option) => option.isCorrect)
      expect(correct.length).toBe(1)
    }
  })

  test('stripMarkdown removes html and links for word counts', () => {
    expect(stripMarkdown('<p>Hello <b>world</b></p> [link](https://x.test)')).toBe(
      'Hello world link',
    )
  })
})
