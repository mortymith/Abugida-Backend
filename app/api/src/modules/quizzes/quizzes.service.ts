/**
 * @module quizzes.service
 *
 * Business logic for the quizzes feature module.
 */

import type { QuizzesRepository } from './quizzes.repository'
import type { QuizQuestionRow, QuizAttemptRow } from './quizzes.repository'
import { encodeCursor } from './quizzes.repository'
import type {
  QuizQuestionView,
  QuizQuestionSetView,
  QuizSubmitRequestView,
  QuizAttemptResultView,
  QuizAttemptDetailView,
  QuizAttemptsQuery,
} from './quizzes.types'

// ── Errors ─────────────────────────────────────────────────────────────────

export class LessonNotFoundError extends Error {
  constructor(message = 'Lesson not found.') {
    super(message)
    this.name = 'LessonNotFoundError'
  }
}

export class LessonNotQuizTypeError extends Error {
  constructor(message = 'Lesson is not a quiz type.') {
    super(message)
    this.name = 'LessonNotQuizTypeError'
  }
}

export class EnrollmentRequiredError extends Error {
  constructor(message = 'You must be enrolled in this course to access the quiz.') {
    super(message)
    this.name = 'EnrollmentRequiredError'
  }
}

export class QuizAttemptNotFoundError extends Error {
  constructor(message = 'Quiz attempt not found.') {
    super(message)
    this.name = 'QuizAttemptNotFoundError'
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toQuizQuestionView(row: QuizQuestionRow): QuizQuestionView {
  return {
    id: row.publicId,
    questionIndex: row.questionIndex,
    questionText: row.questionText,
  }
}

function toQuizAttemptResultView(
  attempt: QuizAttemptRow,
  answers: { questionId: string; isCorrect: boolean; explanation: string | null }[],
): QuizAttemptResultView {
  return {
    attemptId: attempt.publicId,
    attemptNumber: attempt.attemptNumber,
    totalQuestions: attempt.totalQuestions,
    correctAnswers: attempt.correctAnswers,
    scorePercentage: Number.parseFloat(attempt.quizScorePercentage),
    isPassed: attempt.isPassed,
    durationSeconds: attempt.durationSeconds,
    answers,
  }
}

// ── Service ────────────────────────────────────────────────────────────────

export interface QuizzesService {
  getQuizQuestions(publicUserId: string, resourceId: string): Promise<QuizQuestionSetView>
  submitQuiz(
    publicUserId: string,
    resourceId: string,
    body: QuizSubmitRequestView,
  ): Promise<QuizAttemptResultView>
  listQuizAttempts(
    publicUserId: string,
    resourceId: string,
    query: QuizAttemptsQuery,
  ): Promise<{
    data: {
      attemptId: string
      attemptNumber: number
      totalQuestions: number
      correctAnswers: number
      scorePercentage: number
      isPassed: boolean
      durationSeconds: number | null
      startedAt: string
      completedAt: string | null
    }[]
    meta: { cursor: string | null; hasMore: boolean; limit: number }
  }>
  getQuizAttempt(publicUserId: string, attemptId: string): Promise<QuizAttemptDetailView>
}

export function createQuizzesService(repo: QuizzesRepository): QuizzesService {
  async function resolveStudentId(publicUserId: string): Promise<string> {
    const userId = await repo.findUserIdByPublicId(publicUserId)
    if (!userId) throw new EnrollmentRequiredError('User not found.')
    return userId
  }

  return {
    async getQuizQuestions(publicUserId, resourceId) {
      const studentId = await resolveStudentId(publicUserId)

      const lesson = await repo.findLessonByPublicId(resourceId)
      if (!lesson) throw new LessonNotFoundError()
      if (lesson.contentType !== 'quiz') throw new LessonNotQuizTypeError()

      const enrolled = await repo.checkEnrollment(studentId, lesson.id)
      if (!enrolled) throw new EnrollmentRequiredError()

      const questions = await repo.findQuizQuestions(lesson.id)

      return {
        lessonId: resourceId,
        totalQuestions: questions.length,
        questions: questions.map(toQuizQuestionView),
      }
    },

    async submitQuiz(publicUserId, resourceId, body) {
      const studentId = await resolveStudentId(publicUserId)

      const lesson = await repo.findLessonByPublicId(resourceId)
      if (!lesson) throw new LessonNotFoundError()
      if (lesson.contentType !== 'quiz') throw new LessonNotQuizTypeError()

      const enrolled = await repo.checkEnrollment(studentId, lesson.id)
      if (!enrolled) throw new EnrollmentRequiredError()

      const questionsWithAnswers = await repo.findQuizQuestionsWithAnswers(lesson.id)
      const questionMap = new Map(questionsWithAnswers.map((q) => [q.publicId, q]))

      let correctCount = 0
      const answerResults: {
        questionId: string
        isCorrect: boolean
        explanation: string | null
      }[] = []
      const answerValues: {
        questionInternalId: number
        studentAnswer: string
        isCorrect: boolean
      }[] = []

      for (const submittedAnswer of body.answers) {
        const question = questionMap.get(submittedAnswer.questionId)
        if (!question) continue

        const isCorrect =
          submittedAnswer.answer.trim().toLowerCase() ===
          question.correctAnswer.trim().toLowerCase()

        if (isCorrect) correctCount++

        answerResults.push({
          questionId: submittedAnswer.questionId,
          isCorrect,
          explanation: question.explanation,
        })

        answerValues.push({
          questionInternalId: question.id,
          studentAnswer: submittedAnswer.answer,
          isCorrect,
        })
      }

      const totalQuestions = questionsWithAnswers.length
      const scorePercentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0

      const startedAt = new Date(body.startedAt)
      const completedAt = new Date()
      const durationSeconds = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)

      const attemptNumber = await repo.getNextAttemptNumber(studentId, lesson.id)

      const attempt = await repo.createAttempt({
        studentId,
        lessonId: lesson.id,
        attemptNumber,
        totalQuestions,
        correctAnswers: correctCount,
        quizScorePercentage: scorePercentage.toFixed(2),
        isPassed: scorePercentage >= 60,
        durationSeconds,
        startedAt,
        completedAt,
      })

      if (answerValues.length > 0) {
        await repo.createAnswers(
          answerValues.map((a) => ({
            quizAttemptId: attempt.id,
            questionId: a.questionInternalId,
            studentAnswer: a.studentAnswer,
            isCorrect: a.isCorrect,
            answeredAt: completedAt,
          })),
        )
      }

      return toQuizAttemptResultView(attempt, answerResults)
    },

    async listQuizAttempts(publicUserId, resourceId, query) {
      const studentId = await resolveStudentId(publicUserId)

      const lesson = await repo.findLessonByPublicId(resourceId)
      if (!lesson) throw new LessonNotFoundError()
      if (lesson.contentType !== 'quiz') throw new LessonNotQuizTypeError()

      const limit = query.limit ?? 20
      const { rows, hasMore } = await repo.findAttemptsByStudentAndLesson(studentId, lesson.id, {
        cursor: query.cursor,
        limit,
      })

      const lastRow = rows[rows.length - 1]
      return {
        data: rows.map((row) => ({
          attemptId: row.publicId,
          attemptNumber: row.attemptNumber,
          totalQuestions: row.totalQuestions,
          correctAnswers: row.correctAnswers,
          scorePercentage: Number.parseFloat(row.quizScorePercentage),
          isPassed: row.isPassed,
          durationSeconds: row.durationSeconds,
          startedAt: row.startedAt.toISOString(),
          completedAt: row.completedAt?.toISOString() ?? null,
        })),
        meta: {
          cursor: hasMore && lastRow ? encodeCursor(lastRow.id) : null,
          hasMore,
          limit,
        },
      }
    },

    async getQuizAttempt(publicUserId, attemptId) {
      const studentId = await resolveStudentId(publicUserId)

      const attempt = await repo.findAttemptByPublicId(attemptId)
      if (!attempt) throw new QuizAttemptNotFoundError()
      if (attempt.studentId !== studentId) throw new QuizAttemptNotFoundError()

      const answers = await repo.findAnswersByAttemptId(attempt.id)

      return {
        id: attempt.publicId,
        lessonId: '',
        attemptNumber: attempt.attemptNumber,
        totalQuestions: attempt.totalQuestions,
        correctAnswers: attempt.correctAnswers,
        scorePercentage: Number.parseFloat(attempt.quizScorePercentage),
        isPassed: attempt.isPassed,
        durationSeconds: attempt.durationSeconds,
        startedAt: attempt.startedAt.toISOString(),
        completedAt: attempt.completedAt?.toISOString() ?? null,
        answers: answers.map((a) => ({
          questionId: a.questionPublicId,
          questionText: a.questionText,
          studentAnswer: a.studentAnswer,
          isCorrect: a.isCorrect,
          correctAnswer: a.correctAnswer,
          explanation: a.explanation,
        })),
      }
    },
  }
}
