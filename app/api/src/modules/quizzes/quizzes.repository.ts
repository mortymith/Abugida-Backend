/**
 * @module quizzes.repository
 *
 * Database operations for the quizzes feature module.
 */

import { eq, and, desc, lt, isNull, sql } from 'drizzle-orm'
import type { DatabaseClient } from '@abugida/database/client'
import { users } from '@abugida/database/auth'
import { lessons } from '@abugida/database/catalog'
import { enrollments } from '@abugida/database/learning'
import { quizQuestions, quizAttempts, quizAnswers } from '@abugida/database/learning'

// ── Cursor helpers ─────────────────────────────────────────────────────────

function encodeCursor(id: number): string {
  return Buffer.from(`cursor:${id}`).toString('base64url')
}

function decodeCursor(cursor: string | undefined): number | undefined {
  if (!cursor) return undefined
  const decoded = Buffer.from(cursor, 'base64url').toString('utf-8')
  const match = decoded.match(/^cursor:(\d+)$/)
  if (!match?.[1]) throw new Error('Invalid cursor format')
  return Number.parseInt(match[1], 10)
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface LessonRow {
  id: number
  publicId: string
  contentType: string | null
}

export interface QuizQuestionRow {
  id: number
  publicId: string
  questionIndex: number
  questionText: string
}

export interface QuizQuestionWithAnswerRow extends QuizQuestionRow {
  correctAnswer: string
  explanation: string | null
}

export interface QuizAttemptRow {
  id: number
  publicId: string
  studentId: string
  lessonId: number
  attemptNumber: number
  totalQuestions: number
  correctAnswers: number
  quizScorePercentage: string
  isPassed: boolean
  durationSeconds: number | null
  startedAt: Date
  completedAt: Date | null
  createdAt: Date
}

export interface QuizAnswerRow {
  id: number
  publicId: string
  questionId: number
  questionPublicId: string
  questionText: string
  studentAnswer: string | null
  isCorrect: boolean
  correctAnswer: string
  explanation: string | null
}

// ── Repository interface ───────────────────────────────────────────────────

export interface QuizzesRepository {
  findUserIdByPublicId(publicId: string): Promise<string | undefined>
  findLessonByPublicId(publicId: string): Promise<LessonRow | undefined>
  findQuizQuestions(lessonId: number): Promise<QuizQuestionRow[]>
  findQuizQuestionsWithAnswers(lessonId: number): Promise<QuizQuestionWithAnswerRow[]>
  checkEnrollment(studentId: string, lessonId: number): Promise<boolean>
  getNextAttemptNumber(studentId: string, lessonId: number): Promise<number>
  createAttempt(row: {
    studentId: string
    lessonId: number
    attemptNumber: number
    totalQuestions: number
    correctAnswers: number
    quizScorePercentage: string
    isPassed: boolean
    durationSeconds: number | null
    startedAt: Date
    completedAt: Date
  }): Promise<QuizAttemptRow>
  createAnswers(
    answers: {
      quizAttemptId: number
      questionId: number
      studentAnswer: string
      isCorrect: boolean
      answeredAt: Date
    }[],
  ): Promise<void>
  findAttemptsByStudentAndLesson(
    studentId: string,
    lessonId: number,
    opts: { cursor: string | undefined; limit: number },
  ): Promise<{ rows: QuizAttemptRow[]; hasMore: boolean }>
  findAttemptByPublicId(publicId: string): Promise<QuizAttemptRow | undefined>
  findAnswersByAttemptId(attemptId: number): Promise<QuizAnswerRow[]>
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createQuizzesRepository(db: DatabaseClient): QuizzesRepository {
  return {
    async findUserIdByPublicId(publicId) {
      const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, publicId))
        .limit(1)
      return row?.id
    },

    async findLessonByPublicId(publicId) {
      const [row] = await db
        .select({
          id: lessons.id,
          publicId: lessons.publicId,
          contentType: lessons.contentType,
        })
        .from(lessons)
        .where(and(eq(lessons.publicId, publicId), isNull(lessons.deletedAt)))
        .limit(1)
      return row
    },

    async findQuizQuestions(lessonId) {
      return db
        .select({
          id: quizQuestions.id,
          publicId: quizQuestions.publicId,
          questionIndex: quizQuestions.questionIndex,
          questionText: quizQuestions.questionText,
        })
        .from(quizQuestions)
        .where(and(eq(quizQuestions.lessonId, lessonId), isNull(quizQuestions.deletedAt)))
        .orderBy(quizQuestions.questionIndex)
    },

    async findQuizQuestionsWithAnswers(lessonId) {
      return db
        .select({
          id: quizQuestions.id,
          publicId: quizQuestions.publicId,
          questionIndex: quizQuestions.questionIndex,
          questionText: quizQuestions.questionText,
          correctAnswer: quizQuestions.correctAnswer,
          explanation: quizQuestions.explanation,
        })
        .from(quizQuestions)
        .where(and(eq(quizQuestions.lessonId, lessonId), isNull(quizQuestions.deletedAt)))
        .orderBy(quizQuestions.questionIndex)
    },

    async checkEnrollment(studentId, lessonId) {
      const lessonRow = await db
        .select({ courseId: lessons.courseId })
        .from(lessons)
        .where(eq(lessons.id, lessonId))
        .limit(1)

      if (!lessonRow[0]) return false

      const [enrollment] = await db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(enrollments.courseId, lessonRow[0].courseId),
            isNull(enrollments.deletedAt),
          ),
        )
        .limit(1)

      return !!enrollment
    },

    async getNextAttemptNumber(studentId, lessonId) {
      const [result] = await db
        .select({ maxAttempt: sql<number>`COALESCE(MAX(${quizAttempts.attemptNumber}), 0)` })
        .from(quizAttempts)
        .where(and(eq(quizAttempts.studentId, studentId), eq(quizAttempts.lessonId, lessonId)))

      return (result?.maxAttempt ?? 0) + 1
    },

    async createAttempt(row) {
      const [inserted] = await db
        .insert(quizAttempts)
        .values({
          studentId: row.studentId,
          lessonId: row.lessonId,
          attemptNumber: row.attemptNumber,
          totalQuestions: row.totalQuestions,
          correctAnswers: row.correctAnswers,
          quizScorePercentage: row.quizScorePercentage,
          isPassed: row.isPassed,
          durationSeconds: row.durationSeconds,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
        })
        .returning({
          id: quizAttempts.id,
          publicId: quizAttempts.publicId,
          studentId: quizAttempts.studentId,
          lessonId: quizAttempts.lessonId,
          attemptNumber: quizAttempts.attemptNumber,
          totalQuestions: quizAttempts.totalQuestions,
          correctAnswers: quizAttempts.correctAnswers,
          quizScorePercentage: quizAttempts.quizScorePercentage,
          isPassed: quizAttempts.isPassed,
          durationSeconds: quizAttempts.durationSeconds,
          startedAt: quizAttempts.startedAt,
          completedAt: quizAttempts.completedAt,
          createdAt: quizAttempts.createdAt,
        })

      if (!inserted) throw new Error('Failed to create quiz attempt')
      return inserted
    },

    async createAnswers(answers) {
      if (answers.length === 0) return
      await db.insert(quizAnswers).values(
        answers.map((a) => ({
          quizAttemptId: a.quizAttemptId,
          questionId: a.questionId,
          studentAnswer: a.studentAnswer,
          isCorrect: a.isCorrect,
          answeredAt: a.answeredAt,
        })),
      )
    },

    async findAttemptsByStudentAndLesson(studentId, lessonId, opts) {
      const { cursor, limit } = opts
      const effectiveLimit = limit + 1

      const conditions = [
        eq(quizAttempts.studentId, studentId),
        eq(quizAttempts.lessonId, lessonId),
      ]

      const cursorId = decodeCursor(cursor)
      if (cursorId !== undefined) {
        conditions.push(lt(quizAttempts.id, cursorId))
      }

      const rows = await db
        .select()
        .from(quizAttempts)
        .where(and(...conditions))
        .orderBy(desc(quizAttempts.id))
        .limit(effectiveLimit)

      const hasMore = rows.length > limit
      const data = hasMore ? rows.slice(0, limit) : rows

      return { rows: data, hasMore }
    },

    async findAttemptByPublicId(publicId) {
      const [row] = await db
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.publicId, publicId))
        .limit(1)
      return row
    },

    async findAnswersByAttemptId(attemptId) {
      return db
        .select({
          id: quizAnswers.id,
          publicId: quizAnswers.publicId,
          questionId: quizAnswers.questionId,
          questionPublicId: quizQuestions.publicId,
          questionText: quizQuestions.questionText,
          studentAnswer: quizAnswers.studentAnswer,
          isCorrect: quizAnswers.isCorrect,
          correctAnswer: quizQuestions.correctAnswer,
          explanation: quizQuestions.explanation,
        })
        .from(quizAnswers)
        .innerJoin(quizQuestions, eq(quizAnswers.questionId, quizQuestions.id))
        .where(eq(quizAnswers.quizAttemptId, attemptId))
        .orderBy(quizQuestions.questionIndex)
    },
  }
}

export { encodeCursor, decodeCursor }
