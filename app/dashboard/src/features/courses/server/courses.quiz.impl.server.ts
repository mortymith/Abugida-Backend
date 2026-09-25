/**
 * Server-only implementation of S-2.8 Quiz Builder persistence.
 */
import { and, asc, eq, inArray, isNull } from '@abugida/database'
import { quizzes, quizOptions } from '@abugida/database/catalog'
import { quizQuestions } from '@abugida/database/learning'
import { db } from '#/config/db.config'
import { requireAuthoringRole, resolveLesson } from './courses.server-helpers.server'
import { validateQuizQuestions } from '../courses.quiz-validation'
import type { QuestionType, QuizSaveInput } from '../schemas/courses.learning.schema'
import type { QuizDTO, QuizQuestionDTO } from '../courses.types'

export async function getQuizForLessonImpl(lessonPublicId: string): Promise<QuizDTO> {
  await requireAuthoringRole()
  const lesson = await resolveLesson(lessonPublicId)

  const quizRows = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.lessonId, lesson.id), isNull(quizzes.deletedAt)))
    .limit(1)
  const quiz = quizRows.at(0)

  const questionRows = await db
    .select()
    .from(quizQuestions)
    .where(and(eq(quizQuestions.lessonId, lesson.id), isNull(quizQuestions.deletedAt)))
    .orderBy(asc(quizQuestions.questionIndex), asc(quizQuestions.id))

  const questionIds = questionRows.map((question) => question.id)
  const optionRows = questionIds.length
    ? await db
        .select()
        .from(quizOptions)
        .where(and(inArray(quizOptions.questionId, questionIds), isNull(quizOptions.deletedAt)))
        .orderBy(asc(quizOptions.optionIndex), asc(quizOptions.id))
    : []

  const questions: QuizQuestionDTO[] = questionRows.map((question) => {
    const options = optionRows
      .filter((option) => option.questionId === question.id)
      .map((option) => ({
        publicId: option.publicId,
        optionText: option.optionText,
        isCorrect: option.isCorrect,
      }))
    const questionType: QuestionType =
      question.questionType ?? (options.length > 0 ? 'multiple_choice' : 'short_answer')
    const correctOption = options.find((option) => option.isCorrect)
    return {
      publicId: question.publicId,
      questionType,
      questionText: question.questionText,
      points: question.points,
      explanation: question.explanation,
      options,
      correctAnswer:
        questionType === 'short_answer'
          ? question.correctAnswer
          : (correctOption?.optionText ?? null),
    }
  })

  return {
    publicId: quiz?.publicId ?? null,
    lessonPublicId: lesson.publicId,
    title: quiz?.title ?? `${lesson.title} — Quiz`,
    passingScorePercent: quiz?.passingScorePercent ?? 70,
    timeLimitMinutes: quiz?.timeLimitMinutes ?? null,
    maxAttempts: quiz?.maxAttempts ?? null,
    isPublished: quiz?.isPublished ?? false,
    questions,
  }
}

export async function saveQuizImpl(input: QuizSaveInput): Promise<QuizDTO> {
  await requireAuthoringRole()
  const lesson = await resolveLesson(input.lessonPublicId)
  const violations = validateQuizQuestions(input.questions)
  if (violations.length > 0) {
    throw new Error(`QUIZ_INVALID: ${violations[0]?.message ?? 'invalid quiz'}`)
  }

  const result = await db.transaction(async (tx) => {
    const existingQuizRows = await tx
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.lessonId, lesson.id), isNull(quizzes.deletedAt)))
      .limit(1)
    const existingQuiz = existingQuizRows.at(0)

    let quizId: number
    if (existingQuiz) {
      await tx
        .update(quizzes)
        .set({
          title: input.title.trim(),
          passingScorePercent: input.passingScorePercent,
          timeLimitMinutes: input.timeLimitMinutes,
          maxAttempts: input.maxAttempts,
          isPublished: input.isPublished,
        })
        .where(eq(quizzes.id, existingQuiz.id))
      quizId = existingQuiz.id
    } else {
      const inserted = await tx
        .insert(quizzes)
        .values({
          courseId: lesson.courseId,
          lessonId: lesson.id,
          title: input.title.trim(),
          passingScorePercent: input.passingScorePercent,
          timeLimitMinutes: input.timeLimitMinutes,
          maxAttempts: input.maxAttempts,
          isPublished: input.isPublished,
        })
        .returning({ id: quizzes.id })
      quizId = inserted.at(0)!.id
    }

    const existingQuestions = await tx
      .select()
      .from(quizQuestions)
      .where(and(eq(quizQuestions.lessonId, lesson.id), isNull(quizQuestions.deletedAt)))
      .orderBy(asc(quizQuestions.questionIndex))

    const keepPublicIds = new Set(input.questions.filter((q) => q.publicId).map((q) => q.publicId!))
    for (const existing of existingQuestions) {
      if (!keepPublicIds.has(existing.publicId)) {
        // Soft-delete so historical attempts remain intact (FK: quiz_answers).
        await tx
          .update(quizQuestions)
          .set({ deletedAt: new Date() })
          .where(eq(quizQuestions.id, existing.id))
      }
    }

    for (const [index, question] of input.questions.entries()) {
      const correctAnswer =
        question.questionType === 'short_answer'
          ? (question.correctAnswer?.trim() ?? '')
          : (question.options.find((option) => option.isCorrect)?.optionText ?? '')

      if (question.publicId) {
        const existing = existingQuestions.find(
          (candidate) => candidate.publicId === question.publicId,
        )
        if (existing) {
          await tx
            .update(quizQuestions)
            .set({
              questionIndex: index,
              questionType: question.questionType,
              points: question.points,
              questionText: question.questionText.trim(),
              correctAnswer,
              explanation: question.explanation?.trim() || null,
            })
            .where(eq(quizQuestions.id, existing.id))

          await tx
            .update(quizOptions)
            .set({ deletedAt: new Date() })
            .where(and(eq(quizOptions.questionId, existing.id), isNull(quizOptions.deletedAt)))

          if (question.questionType !== 'short_answer') {
            await tx.insert(quizOptions).values(
              question.options.map((option, optionIndex) => ({
                questionId: existing.id,
                optionIndex,
                optionText: option.optionText.trim(),
                isCorrect: option.isCorrect,
              })),
            )
          }
          continue
        }
      }

      const insertedQuestion = await tx
        .insert(quizQuestions)
        .values({
          lessonId: lesson.id,
          questionIndex: index,
          questionType: question.questionType,
          points: question.points,
          questionText: question.questionText.trim(),
          correctAnswer,
          explanation: question.explanation?.trim() || null,
        })
        .returning({ id: quizQuestions.id })
      const questionId = insertedQuestion.at(0)!.id

      if (question.questionType !== 'short_answer') {
        await tx.insert(quizOptions).values(
          question.options.map((option, optionIndex) => ({
            questionId,
            optionIndex,
            optionText: option.optionText.trim(),
            isCorrect: option.isCorrect,
          })),
        )
      }
    }

    return { quizId }
  })

  void result
  return getQuizForLessonImpl(lesson.publicId)
}
