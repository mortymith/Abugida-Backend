import { describe, it, expect } from 'bun:test'
import {
  insertEnrollmentSchema,
  insertLessonCompletionSchema,
  insertQuizQuestionSchema,
  insertQuizAttemptSchema,
  insertQuizAnswerSchema,
  insertQuizAnswerHistorySchema,
  insertCourseReviewSchema,
  enrollmentSourceEnum,
  moderationStatusEnum,
} from '../../schema/learning'

describe('learning schemas', () => {
  describe('enrollments', () => {
    const validEnrollment = {
      studentId: 1,
      courseId: 1,
      enrollmentSource: 'purchase' as const,
      progressPercentage: 0,
      isCompleted: false,
      rowVersion: 1,
    }

    it('accepts valid enrollment insert', () => {
      const result = insertEnrollmentSchema.safeParse(validEnrollment)
      expect(result.success).toBe(true)
    })

    it('validates progressPercentage range', () => {
      expect(
        insertEnrollmentSchema.safeParse({
          ...validEnrollment,
          progressPercentage: -1,
        }).success,
      ).toBe(false)
      expect(
        insertEnrollmentSchema.safeParse({
          ...validEnrollment,
          progressPercentage: 101,
        }).success,
      ).toBe(false)
    })

    it('validates rowVersion min', () => {
      expect(
        insertEnrollmentSchema.safeParse({
          ...validEnrollment,
          rowVersion: 0,
        }).success,
      ).toBe(false)
    })

    it('accepts all enrollment sources', () => {
      for (const source of enrollmentSourceEnum.options) {
        const result = insertEnrollmentSchema.safeParse({
          ...validEnrollment,
          enrollmentSource: source,
        })
        expect(result.success).toBe(true)
      }
    })

    it('accepts bundle enrollment', () => {
      const result = insertEnrollmentSchema.safeParse({
        ...validEnrollment,
        enrollmentSource: 'bundle_purchase',
        bundleId: 1,
        purchaseId: 1,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('lesson completions', () => {
    const validCompletion = {
      studentId: 1,
      lessonId: 1,
      enrollmentId: 1,
      isCompleted: true,
      timeSpentSeconds: 300,
      rowVersion: 1,
    }

    it('accepts valid completion insert', () => {
      const result = insertLessonCompletionSchema.safeParse(validCompletion)
      expect(result.success).toBe(true)
    })

    it('validates timeSpentSeconds min', () => {
      expect(
        insertLessonCompletionSchema.safeParse({
          ...validCompletion,
          timeSpentSeconds: -1,
        }).success,
      ).toBe(false)
    })

    it('validates rowVersion min', () => {
      expect(
        insertLessonCompletionSchema.safeParse({
          ...validCompletion,
          rowVersion: 0,
        }).success,
      ).toBe(false)
    })
  })

  describe('quiz questions', () => {
    const validQuestion = {
      lessonId: 1,
      questionIndex: 0,
      questionText: 'What is 2 + 2?',
      correctAnswer: '4',
      explanation: 'Basic addition',
      rowVersion: 1,
    }

    it('accepts valid question insert', () => {
      const result = insertQuizQuestionSchema.safeParse(validQuestion)
      expect(result.success).toBe(true)
    })

    it('validates questionIndex min', () => {
      expect(
        insertQuizQuestionSchema.safeParse({
          ...validQuestion,
          questionIndex: -1,
        }).success,
      ).toBe(false)
    })

    it('requires questionText', () => {
      const result = insertQuizQuestionSchema.safeParse({
        lessonId: 1,
        questionIndex: 0,
        correctAnswer: '4',
        rowVersion: 1,
      })
      expect(result.success).toBe(false)
    })

    it('requires correctAnswer', () => {
      const result = insertQuizQuestionSchema.safeParse({
        lessonId: 1,
        questionIndex: 0,
        questionText: 'Test?',
        rowVersion: 1,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('quiz attempts', () => {
    const validAttempt = {
      studentId: 1,
      lessonId: 1,
      attemptNumber: 1,
      totalQuestions: 10,
      correctAnswers: 7,
      quizScorePercentage: 70,
      isPassed: true,
      startedAt: new Date(),
    }

    it('accepts valid attempt insert', () => {
      const result = insertQuizAttemptSchema.safeParse(validAttempt)
      expect(result.success).toBe(true)
    })

    it('validates attemptNumber min', () => {
      expect(
        insertQuizAttemptSchema.safeParse({
          ...validAttempt,
          attemptNumber: 0,
        }).success,
      ).toBe(false)
    })

    it('validates totalQuestions positive', () => {
      expect(
        insertQuizAttemptSchema.safeParse({
          ...validAttempt,
          totalQuestions: 0,
        }).success,
      ).toBe(false)
    })

    it('validates correctAnswers min', () => {
      expect(
        insertQuizAttemptSchema.safeParse({
          ...validAttempt,
          correctAnswers: -1,
        }).success,
      ).toBe(false)
    })

    it('validates quizScorePercentage range', () => {
      expect(
        insertQuizAttemptSchema.safeParse({
          ...validAttempt,
          quizScorePercentage: -1,
        }).success,
      ).toBe(false)
      expect(
        insertQuizAttemptSchema.safeParse({
          ...validAttempt,
          quizScorePercentage: 101,
        }).success,
      ).toBe(false)
    })

    it('validates durationSeconds min', () => {
      expect(
        insertQuizAttemptSchema.safeParse({
          ...validAttempt,
          durationSeconds: -1,
        }).success,
      ).toBe(false)
    })
  })

  describe('quiz answers', () => {
    const validAnswer = {
      quizAttemptId: 1,
      questionId: 1,
      studentAnswer: '4',
      isCorrect: true,
      answeredAt: new Date(),
      rowVersion: 1,
    }

    it('accepts valid answer insert', () => {
      const result = insertQuizAnswerSchema.safeParse(validAnswer)
      expect(result.success).toBe(true)
    })

    it('validates rowVersion min', () => {
      expect(
        insertQuizAnswerSchema.safeParse({
          ...validAnswer,
          rowVersion: 0,
        }).success,
      ).toBe(false)
    })
  })

  describe('quiz answer history', () => {
    const validHistory = {
      quizAnswerId: 1,
      oldIsCorrect: false,
      newIsCorrect: true,
      oldStudentAnswer: '3',
      newStudentAnswer: '4',
      changedBy: 1,
      changeReason: 'Correction',
    }

    it('accepts valid history insert', () => {
      const result = insertQuizAnswerHistorySchema.safeParse(validHistory)
      expect(result.success).toBe(true)
    })

    it('validates changeReason max length', () => {
      expect(
        insertQuizAnswerHistorySchema.safeParse({
          ...validHistory,
          changeReason: 'x'.repeat(201),
        }).success,
      ).toBe(false)
    })
  })

  describe('course reviews', () => {
    const validReview = {
      studentId: 1,
      courseId: 1,
      rating: 4,
      title: 'Great course',
      content: 'Very helpful for TOEFL preparation.',
      moderationStatus: 'pending' as const,
    }

    it('accepts valid review insert', () => {
      const result = insertCourseReviewSchema.safeParse(validReview)
      expect(result.success).toBe(true)
    })

    it('validates rating range', () => {
      expect(insertCourseReviewSchema.safeParse({ ...validReview, rating: 0 }).success).toBe(false)
      expect(insertCourseReviewSchema.safeParse({ ...validReview, rating: 6 }).success).toBe(false)
    })

    it('validates title max length', () => {
      expect(
        insertCourseReviewSchema.safeParse({
          ...validReview,
          title: 'x'.repeat(201),
        }).success,
      ).toBe(false)
    })

    it('requires content', () => {
      const result = insertCourseReviewSchema.safeParse({
        studentId: 1,
        courseId: 1,
        rating: 4,
        title: 'Great',
        moderationStatus: 'pending',
      })
      expect(result.success).toBe(false)
    })

    it('accepts all moderation statuses', () => {
      for (const status of moderationStatusEnum.options) {
        const result = insertCourseReviewSchema.safeParse({
          ...validReview,
          moderationStatus: status,
        })
        expect(result.success).toBe(true)
      }
    })
  })
})
