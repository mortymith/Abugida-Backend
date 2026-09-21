import { z } from 'zod'

/** S-2.8 quiz authoring. Type drives rendering: options for MC/TF, text key for short answer. */
export const questionTypeSchema = z.enum(['multiple_choice', 'true_false', 'short_answer'])
export type QuestionType = z.infer<typeof questionTypeSchema>

export const quizOptionInputSchema = z.object({
  optionText: z.string().trim().min(1, 'Option text is required'),
  isCorrect: z.boolean(),
})

export const quizQuestionInputSchema = z
  .object({
    questionType: questionTypeSchema,
    questionText: z.string().trim().min(3, 'Question is required'),
    points: z.number().int().min(1).max(100).default(10),
    explanation: z.string().trim().max(2000).optional(),
    options: z.array(quizOptionInputSchema).default([]),
    /** Short-answer key (used when questionType is short_answer). */
    correctAnswer: z.string().trim().optional(),
  })
  .superRefine((question, ctx) => {
    if (question.questionType === 'short_answer') {
      if (!question.correctAnswer || question.correctAnswer.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['correctAnswer'],
          message: 'Provide the expected answer',
        })
      }
      return
    }
    if (question.questionType === 'true_false' && question.options.length !== 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'True/False needs exactly two options',
      })
    }
    if (question.questionType === 'multiple_choice' && question.options.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['options'],
        message: 'Add at least two options',
      })
    }
  })

export const quizSaveSchema = z.object({
  lessonPublicId: z.string().uuid(),
  title: z.string().trim().min(3).max(300),
  passingScorePercent: z.number().int().min(1).max(100),
  timeLimitMinutes: z.number().int().positive().nullable().default(null),
  maxAttempts: z.number().int().positive().nullable().default(null),
  isPublished: z.boolean().default(false),
  questions: z.array(quizQuestionInputSchema).min(1, 'Add at least one question'),
})

export type QuizSaveInput = z.infer<typeof quizSaveSchema>

/** S-2.15 unlock rules. */
export const unlockConditionSchema = z.enum(['viewed', 'completed', 'quiz_score'])
export type UnlockCondition = z.infer<typeof unlockConditionSchema>

export const unlockRequirementInputSchema = z
  .object({
    requiredLessonPublicId: z.string().uuid(),
    condition: unlockConditionSchema,
    thresholdPercent: z.number().int().min(1).max(100).nullable().default(null),
  })
  .superRefine((requirement, ctx) => {
    if (requirement.condition === 'quiz_score' && requirement.thresholdPercent == null) {
      ctx.addIssue({
        code: 'custom',
        path: ['thresholdPercent'],
        message: 'Set the pass threshold (1-100%)',
      })
    }
  })

export const unlockRulesSaveSchema = z.object({
  lessonPublicId: z.string().uuid(),
  enabled: z.boolean(),
  requirements: z.array(unlockRequirementInputSchema).default([]),
  lockBehavior: z.enum(['hidden', 'visible_locked']).default('visible_locked'),
  customMessage: z.string().trim().max(500).optional(),
})

export type UnlockRulesSaveInput = z.infer<typeof unlockRulesSaveSchema>

/** S-2.9 live sessions. */
export const liveSessionSaveSchema = z.object({
  coursePublicId: z.string().uuid(),
  sessionPublicId: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(300),
  description: z.string().trim().max(2000).optional(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().nullable().default(null),
  hostId: z.string().trim().min(1),
  provider: z.enum(['zoom', 'google_meet', 'custom']).default('custom'),
  joinUrl: z.string().url().max(500).nullable().default(null),
  autoRecord: z.boolean().default(false),
  reminder24h: z.boolean().default(true),
  reminder1h: z.boolean().default(true),
})

export type LiveSessionSaveInput = z.infer<typeof liveSessionSaveSchema>

export const liveSessionCancelSchema = z.object({
  sessionPublicId: z.string().uuid(),
  notifyAttendees: z.boolean().default(false),
})

/** S-2.10 completion rules + certificate template. */
export const completionRulesSaveSchema = z.object({
  coursePublicId: z.string().uuid(),
  rule: z.enum(['all_lessons', 'min_percent_quiz']),
  minPercent: z.number().int().min(1).max(100).default(80),
  autoIssue: z.boolean().default(true),
  certificate: z.object({
    title: z.string().trim().min(3).max(200),
    showStudentName: z.boolean().default(true),
    showCourseTitle: z.boolean().default(true),
    showCompletionDate: z.boolean().default(true),
    showSignature: z.boolean().default(true),
    signatureObjectKey: z.string().trim().max(500).nullable().default(null),
    signatureLabel: z.string().trim().max(150).nullable().default(null),
  }),
})

export type CompletionRulesSaveInput = z.infer<typeof completionRulesSaveSchema>
