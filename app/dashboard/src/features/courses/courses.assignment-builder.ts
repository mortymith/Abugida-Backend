/**
 * Assignment Builder logic (spec 04 § S-2.23 → Assignment Builder, § RC-4c).
 *
 * An assignment is a curriculum item with `contentType='exercise'`. The
 * builder has four parts:
 *
 * 1. **Brief** (Markdown) — the assignment prompt.
 * 2. **Rubric** — criteria/levels/weights matrix used for grading.
 * 3. **Submission channels** — online text, file upload, external link.
 * 4. **Settings** — grading mode, points, feedback release, prerequisites.
 *
 * RC-4c (the readiness check that gates publishing an assignment):
 *
 * > Every Assignment in the published set has a brief of ≥50 chars prose
 * > AND ≥1 enabled submission channel.
 *
 * `assignment.grade` capability is Admin AND Editor (not Admin-only) —
 * enforced in `courses.capabilities.ts`, not here.
 *
 * This module is framework-free: it owns the rubric validation, the
 * submission-channel config, and the RC-4c evaluation. The React component
 * (`AssignmentBuilder`) is a consumer.
 */

import { countProseCharacters } from './courses.readiness'

export const ASSIGNMENT_MIN_PROSE_CHARS = 50

export const SUBMISSION_CHANNELS = ['online_text', 'file_upload', 'external_link'] as const

export type SubmissionChannel = (typeof SUBMISSION_CHANNELS)[number]

export const SUBMISSION_CHANNEL_LABELS: Record<SubmissionChannel, string> = {
  online_text: 'Online text',
  file_upload: 'File upload',
  external_link: 'External link',
}

export type GradingMode = 'points' | 'rubric' | 'pass_fail'

export const GRADING_MODE_LABELS: Record<GradingMode, string> = {
  points: 'Points',
  rubric: 'Rubric score',
  pass_fail: 'Pass/fail',
}

export type FeedbackRelease = 'immediately' | 'after_due_date'

export interface RubricCriterion {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly weight: number // 0–100, relative to other criteria
  readonly levels: readonly RubricLevel[]
}

export interface RubricLevel {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly points: number
}

export interface AssignmentConfig {
  readonly brief: string
  readonly submissionChannels: ReadonlySet<SubmissionChannel>
  readonly gradingMode: GradingMode
  readonly pointsValue: number | null
  readonly feedbackRelease: FeedbackRelease
  readonly attempts: number
  readonly dueDate: string | null // ISO-8601 with offset, EAT
  readonly lateSubmissionsAccepted: boolean
  readonly rubric: readonly RubricCriterion[]
}

export interface RubricValidationError {
  readonly criterionId: string
  readonly message: string
}

/**
 * Validate a rubric. The rules (from spec 04 § S-2.23):
 *
 * - Every criterion has a non-empty name.
 * - Every criterion has at least 2 levels.
 * - Every level has a non-empty label.
 * - Weights are non-negative and sum to 100 (allow ±1 for rounding).
 * - Points are non-negative.
 */
export function validateRubric(rubric: readonly RubricCriterion[]): RubricValidationError[] {
  const errors: RubricValidationError[] = []

  for (const criterion of rubric) {
    if (!criterion.name.trim()) {
      errors.push({ criterionId: criterion.id, message: 'Criterion name is required' })
    }
    if (criterion.levels.length < 2) {
      errors.push({
        criterionId: criterion.id,
        message: 'A criterion needs at least 2 levels',
      })
    }
    for (const level of criterion.levels) {
      if (!level.label.trim()) {
        errors.push({ criterionId: criterion.id, message: 'Every level needs a label' })
      }
      if (level.points < 0) {
        errors.push({ criterionId: criterion.id, message: 'Points must be non-negative' })
      }
    }
    if (criterion.weight < 0) {
      errors.push({ criterionId: criterion.id, message: 'Weight must be non-negative' })
    }
  }

  // Weights should sum to 100 (±1 for rounding).
  const totalWeight = rubric.reduce((sum, c) => sum + c.weight, 0)
  if (rubric.length > 0 && Math.abs(totalWeight - 100) > 1) {
    errors.push({
      criterionId: '_root',
      message: `Rubric weights must sum to 100 (currently ${totalWeight})`,
    })
  }

  return errors
}

/**
 * Evaluate RC-4c for an assignment.
 *
 * > Every Assignment in the published set has a brief of ≥50 chars prose
 * > AND ≥1 enabled submission channel.
 *
 * The prose count uses `countProseCharacters` from the readiness module —
 * the same function RC-4a uses for lessons, so Markdown punctuation is
 * excluded consistently.
 */
export interface AssignmentReadinessResult {
  readonly passed: boolean
  readonly blocking: boolean
  readonly checks: {
    readonly briefProse: {
      readonly passed: boolean
      readonly count: number
      readonly required: number
    }
    readonly submissionChannel: { readonly passed: boolean; readonly enabledCount: number }
  }
}

export function evaluateAssignmentReadiness(
  config: Pick<AssignmentConfig, 'brief' | 'submissionChannels'>,
): AssignmentReadinessResult {
  const proseCount = countProseCharacters(config.brief)
  const briefPassed = proseCount >= ASSIGNMENT_MIN_PROSE_CHARS
  const channelPassed = config.submissionChannels.size > 0

  return {
    passed: briefPassed && channelPassed,
    blocking: !briefPassed || !channelPassed,
    checks: {
      briefProse: { passed: briefPassed, count: proseCount, required: ASSIGNMENT_MIN_PROSE_CHARS },
      submissionChannel: { passed: channelPassed, enabledCount: config.submissionChannels.size },
    },
  }
}

/**
 * Default assignment config for a newly created assignment item.
 * Mirrors the spec's defaults: brief empty, no channels, points grading,
 * 100 points, immediate feedback, 1 attempt, no due date.
 */
export function defaultAssignmentConfig(): AssignmentConfig {
  return {
    brief: '',
    submissionChannels: new Set<SubmissionChannel>(),
    gradingMode: 'points',
    pointsValue: 100,
    feedbackRelease: 'immediately',
    attempts: 1,
    dueDate: null,
    lateSubmissionsAccepted: false,
    rubric: [],
  }
}
