import { describe, expect, test } from 'bun:test'
import {
  ASSIGNMENT_MIN_PROSE_CHARS,
  defaultAssignmentConfig,
  evaluateAssignmentReadiness,
  GRADING_MODE_LABELS,
  SUBMISSION_CHANNELS,
  SUBMISSION_CHANNEL_LABELS,
  validateRubric,
} from '#/features/courses/courses.assignment-builder'
import type { RubricCriterion } from '#/features/courses/courses.assignment-builder'

describe('assignment constants', () => {
  test('min prose is 50 chars (RC-4c)', () => {
    expect(ASSIGNMENT_MIN_PROSE_CHARS).toBe(50)
  })

  test('three submission channels', () => {
    expect(SUBMISSION_CHANNELS).toEqual(['online_text', 'file_upload', 'external_link'])
    expect(SUBMISSION_CHANNEL_LABELS).toEqual({
      online_text: 'Online text',
      file_upload: 'File upload',
      external_link: 'External link',
    })
  })

  test('three grading modes', () => {
    expect(Object.keys(GRADING_MODE_LABELS)).toEqual(['points', 'rubric', 'pass_fail'])
  })
})

describe('defaultAssignmentConfig', () => {
  test('defaults match spec: empty brief, no channels, points grading, 100 pts, immediate, 1 attempt', () => {
    const config = defaultAssignmentConfig()
    expect(config.brief).toBe('')
    expect(config.submissionChannels.size).toBe(0)
    expect(config.gradingMode).toBe('points')
    expect(config.pointsValue).toBe(100)
    expect(config.feedbackRelease).toBe('immediately')
    expect(config.attempts).toBe(1)
    expect(config.dueDate).toBeNull()
    expect(config.lateSubmissionsAccepted).toBe(false)
    expect(config.rubric).toEqual([])
  })
})

describe('evaluateAssignmentReadiness (RC-4c)', () => {
  test('fails when brief is empty', () => {
    const result = evaluateAssignmentReadiness({
      brief: '',
      submissionChannels: new Set(['online_text']),
    })
    expect(result.passed).toBe(false)
    expect(result.blocking).toBe(true)
    expect(result.checks.briefProse.passed).toBe(false)
    expect(result.checks.briefProse.count).toBe(0)
  })

  test('fails when no submission channels enabled', () => {
    const longBrief =
      'This is a sufficiently long assignment brief that exceeds the fifty character minimum.'
    const result = evaluateAssignmentReadiness({
      brief: longBrief,
      submissionChannels: new Set(),
    })
    expect(result.passed).toBe(false)
    expect(result.blocking).toBe(true)
    expect(result.checks.submissionChannel.passed).toBe(false)
    expect(result.checks.submissionChannel.enabledCount).toBe(0)
  })

  test('passes when brief >= 50 chars prose AND >= 1 channel', () => {
    const longBrief =
      'This is a sufficiently long assignment brief that exceeds the fifty character minimum.'
    const result = evaluateAssignmentReadiness({
      brief: longBrief,
      submissionChannels: new Set(['online_text']),
    })
    expect(result.passed).toBe(true)
    expect(result.blocking).toBe(false)
    expect(result.checks.briefProse.passed).toBe(true)
    expect(result.checks.briefProse.count).toBeGreaterThanOrEqual(50)
    expect(result.checks.submissionChannel.passed).toBe(true)
  })

  test('markdown punctuation is excluded from prose count (consistent with RC-4a)', () => {
    // A brief of only markdown heading/emphasis markers and separators — no
    // actual words — should count as 0 prose chars.
    const markdownOnly = '### *** --- ___ ~~~ ###'
    const result = evaluateAssignmentReadiness({
      brief: markdownOnly,
      submissionChannels: new Set(['online_text']),
    })
    expect(result.checks.briefProse.count).toBe(0)
    expect(result.checks.briefProse.passed).toBe(false)
  })
})

describe('validateRubric', () => {
  const validCriterion: RubricCriterion = {
    id: 'c1',
    name: 'Clarity',
    description: 'How clear is the submission?',
    weight: 50,
    levels: [
      { id: 'l1', label: 'Excellent', description: 'Crystal clear', points: 5 },
      { id: 'l2', label: 'Needs work', description: 'Confusing', points: 2 },
    ],
  }

  test('valid rubric produces no errors', () => {
    const errors = validateRubric([
      validCriterion,
      { ...validCriterion, id: 'c2', name: 'Depth', weight: 50 },
    ])
    expect(errors).toHaveLength(0)
  })

  test('criterion with empty name errors', () => {
    const errors = validateRubric([{ ...validCriterion, name: '' }])
    expect(errors.some((e) => e.message.includes('name is required'))).toBe(true)
  })

  test('criterion with fewer than 2 levels errors', () => {
    const errors = validateRubric([{ ...validCriterion, levels: [validCriterion.levels[0]] }])
    expect(errors.some((e) => e.message.includes('at least 2 levels'))).toBe(true)
  })

  test('weights not summing to 100 errors', () => {
    const errors = validateRubric([
      validCriterion,
      { ...validCriterion, id: 'c2', name: 'Depth', weight: 40 }, // 50 + 40 = 90
    ])
    expect(errors.some((e) => e.message.includes('sum to 100'))).toBe(true)
  })

  test('negative points errors', () => {
    const errors = validateRubric([
      {
        ...validCriterion,
        levels: [
          { id: 'l1', label: 'A', description: '', points: -5 },
          { id: 'l2', label: 'B', description: '', points: 2 },
        ],
      },
    ])
    expect(errors.some((e) => e.message.includes('non-negative'))).toBe(true)
  })

  test('empty rubric produces no errors (rubric is optional)', () => {
    const errors = validateRubric([])
    expect(errors).toHaveLength(0)
  })
})
