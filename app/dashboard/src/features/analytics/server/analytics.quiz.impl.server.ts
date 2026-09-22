/**
 * Server-only implementation of S-5.2 Quiz Analytics: attempt summary,
 * per-question correct %/timing, and answer-choice distributions for one quiz
 * lesson. Aggregation of raw answers happens here; only aggregates ship to
 * the browser (no student identifiers leave the server).
 * Never import from client code.
 */
import { and, eq, sql } from '@abugida/database'
import { lessons, modules, quizOptions } from '@abugida/database/catalog'
import { quizAnswers, quizAttempts, quizQuestions } from '@abugida/database/learning'
import { db } from '#/config/db.config'
import { resolveDateRange } from '#/features/dashboard/schemas/dashboard.date-range.schema'
import type { AnalyticsRangeInput } from '../schemas/analytics.schema'
import {
  resolveCourse,
  resolveCourseLesson,
  getSessionRole,
} from './analytics.server-helpers.server'
import { buildQuestionRows, buildQuizSummary } from '../analytics.metric-math'
import type { AnswerEventInput, QuestionMetaInput } from '../analytics.metric-math'
import type { QuizAnalytics } from '../analytics.types'

export async function loadQuizAnalytics(
  coursePublicId: string,
  lessonPublicId: string,
  input: AnalyticsRangeInput,
): Promise<QuizAnalytics> {
  await getSessionRole()
  const course = await resolveCourse(coursePublicId)
  const lesson = await resolveCourseLesson(course.id, lessonPublicId)
  const range = resolveDateRange(input)
  const { from, to } = range

  // ── Attempts in range (windowed by start) ──
  const attemptRows = await db
    .select({
      id: quizAttempts.id,
      startedAt: quizAttempts.startedAt,
      scorePct: quizAttempts.quizScorePercentage,
      isPassed: quizAttempts.isPassed,
    })
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.lessonId, lesson.id),
        sql`${quizAttempts.startedAt} >= ${from} AND ${quizAttempts.startedAt} < ${to}`,
      ),
    )
  const summary = buildQuizSummary(
    attemptRows.map((row) => ({ scorePct: Number(row.scorePct), isPassed: row.isPassed })),
  )

  // ── Questions (insertion order = builder order) + option labels ──
  const questionRows = await db
    .select({ id: quizQuestions.id, prompt: quizQuestions.questionText })
    .from(quizQuestions)
    .where(eq(quizQuestions.lessonId, lesson.id))
    .orderBy(quizQuestions.id)
  const optionRows = await db
    .select({ questionId: quizOptions.questionId, optionText: quizOptions.optionText })
    .from(quizOptions)
    .innerJoin(quizQuestions, eq(quizQuestions.id, quizOptions.questionId))
    .where(eq(quizQuestions.lessonId, lesson.id))
    .orderBy(quizOptions.id)
  const optionsByQuestion = new Map<number, string[]>()
  for (const row of optionRows) {
    const list = optionsByQuestion.get(row.questionId) ?? []
    list.push(row.optionText)
    optionsByQuestion.set(row.questionId, list)
  }

  // ── Raw answer events for the range's attempts (aggregated below, never shipped) ──
  const answerRows =
    attemptRows.length === 0
      ? []
      : await db
          .select({
            attemptId: quizAnswers.quizAttemptId,
            questionId: quizAnswers.questionId,
            studentAnswer: quizAnswers.studentAnswer,
            isCorrect: quizAnswers.isCorrect,
            answeredAt: quizAnswers.answeredAt,
          })
          .from(quizAnswers)
          .innerJoin(quizAttempts, eq(quizAttempts.id, quizAnswers.quizAttemptId))
          .where(
            and(
              eq(quizAttempts.lessonId, lesson.id),
              sql`${quizAttempts.startedAt} >= ${from} AND ${quizAttempts.startedAt} < ${to}`,
            ),
          )

  const answersByAttempt = new Map<number, AnswerEventInput['answers']>()
  for (const row of answerRows) {
    const list = answersByAttempt.get(row.attemptId) ?? []
    list.push({
      questionId: row.questionId,
      studentAnswer: row.studentAnswer,
      isCorrect: row.isCorrect,
      answeredAt: new Date(row.answeredAt),
    })
    answersByAttempt.set(row.attemptId, list)
  }
  const attempts: AnswerEventInput[] = attemptRows.map((row) => ({
    attemptId: row.id,
    startedAt: new Date(row.startedAt),
    answers: answersByAttempt.get(row.id) ?? [],
  }))

  const questions: QuestionMetaInput[] = questionRows.map((row) => ({
    questionId: row.id,
    prompt: row.prompt,
    optionTexts: optionsByQuestion.get(row.id) ?? [],
  }))
  const questionRowsOut = buildQuestionRows(attempts, questions)
  // Worst first (spec default sort), never-answered last.
  questionRowsOut.sort((a, b) => {
    const aKey = a.correctPct ?? Number.POSITIVE_INFINITY
    const bKey = b.correctPct ?? Number.POSITIVE_INFINITY
    return aKey - bKey
  })

  // ── Header context: owning module title (spec header shows the quiz name) ──
  const moduleRows = await db
    .select({ title: modules.title })
    .from(modules)
    .innerJoin(lessons, eq(lessons.moduleId, modules.id))
    .where(eq(lessons.id, lesson.id))
    .limit(1)
  const moduleTitle = moduleRows.at(0)?.title

  return {
    quiz: {
      lessonId: lesson.publicId,
      title: moduleTitle ? `${moduleTitle} — ${lesson.title}` : lesson.title,
      courseId: course.publicId,
      courseTitle: course.title,
    },
    range: { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
    summary,
    questions: questionRowsOut,
    isEmpty: attemptRows.length === 0,
  }
}
