/**
 * S-5.2 Quiz flags logic (spec 07 § S-5.2).
 *
 * The spec:
 * - `QUIZ_LOW_CORRECT_PCT = 50` flags a question students get wrong more
 *   than half the time.
 * - `QUIZ_TOO_EASY_PCT = 95` flags a question almost everyone gets right.
 *   "A high correct rate may mean the question is ambiguous, not that it
 *   is wrong."
 * - Both are named constants with tooltips naming the miss rate, the
 *   threshold, and `n`.
 * - The insight for a flagged question offers "Append the top wrong
 *   answer as a distractor" as a named action.
 */

import {
  isLowCorrect,
  isTooEasy,
  QUIZ_LOW_CORRECT_PCT,
  QUIZ_TOO_EASY_PCT,
  shouldSuppress,
  TOO_EASY_AMBIGUITY_NOTE,
} from './analytics.metric-dictionary'

export type QuizFlag = 'low_correct' | 'too_easy' | null

export interface QuizFlagResult {
  readonly flag: QuizFlag
  readonly tooltip: string | null
  readonly insightAction: string | null
}

/**
 * Flag a quiz question based on its correct rate and sample size. The
 * spec: both thresholds are named constants, both render a badge with a
 * tooltip naming the miss rate, the threshold, and `n`.
 *
 * Returns `null` flag when `n < MIN_SAMPLE_SIZE` (the question renders `—`
 * and is excluded from the flagged sort).
 */
export function flagQuestion(correctPct: number, n: number): QuizFlagResult {
  // Below MIN_SAMPLE_SIZE: no flag, excluded from sort.
  if (shouldSuppress(n)) {
    return { flag: null, tooltip: null, insightAction: null }
  }

  if (isTooEasy(correctPct)) {
    const missRate = 100 - correctPct
    return {
      flag: 'too_easy',
      tooltip: `Correct rate ${correctPct}% (threshold ${QUIZ_TOO_EASY_PCT}%), miss rate ${missRate}%, n=${n}.`,
      insightAction: null, // Too-easy has no distractor action.
    }
  }

  if (isLowCorrect(correctPct)) {
    const missRate = 100 - correctPct
    return {
      flag: 'low_correct',
      tooltip: `Correct rate ${correctPct}% (threshold ${QUIZ_LOW_CORRECT_PCT}%), miss rate ${missRate}%, n=${n}.`,
      insightAction: 'Append the top wrong answer as a distractor',
    }
  }

  return { flag: null, tooltip: null, insightAction: null }
}

/**
 * The ambiguity note for too-easy questions. The spec: "High correct
 * rate. If the wording is ambiguous, students may be guessing correctly
 * rather than understanding."
 */
export function tooEasyNote(): string {
  return TOO_EASY_AMBIGUITY_NOTE
}

export interface AnswerDistributionEntry {
  readonly optionId: string
  readonly optionText: string
  readonly isCorrect: boolean
  readonly selectionCount: number
  readonly selectionPct: number
}

/**
 * Identify the top wrong answer from a distribution. The spec: "the top
 * wrong answer named" — used for the "Append the top wrong answer as a
 * distractor" action.
 */
export function identifyTopWrongAnswer(
  distribution: readonly AnswerDistributionEntry[],
): AnswerDistributionEntry | null {
  const wrongAnswers = distribution.filter((d) => !d.isCorrect && d.selectionCount > 0)
  if (wrongAnswers.length === 0) return null
  return wrongAnswers.reduce((top, current) =>
    current.selectionCount > top.selectionCount ? current : top,
  )
}

/**
 * The miss rate for a question (100 - correctPct). Used in tooltips and
 * insights.
 */
export function computeMissRate(correctPct: number): number {
  return 100 - correctPct
}

/**
 * Whether a question should be excluded from the flagged sort. The spec:
 * "A question with fewer than `MIN_SAMPLE_SIZE = 5` attempts renders `—`
 * and is excluded from the flagged sort."
 */
export function shouldExcludeFromFlaggedSort(n: number): boolean {
  return shouldSuppress(n)
}

/**
 * The "Revise" deep-link URL. The spec: "The Revise deep link carries
 * `?item=<publicId>&question=<questionId>` and moves focus to the
 * question, not to the top of the quiz."
 */
export function buildReviseDeepLink(
  coursePublicId: string,
  itemPublicId: string,
  questionId: string,
): string {
  return `/courses/${coursePublicId}?tab=curriculum&item=${itemPublicId}&question=${questionId}`
}
