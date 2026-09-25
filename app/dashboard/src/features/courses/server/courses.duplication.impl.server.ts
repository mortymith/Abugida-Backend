/**
 * Server-only implementation of S-7.7 "Duplicate lesson to another course".
 *
 * The whole copy runs in one transaction. The previous client-side
 * implementation chained `createLesson` + `saveLesson` and then located the
 * freshly created row by *title match* against the returned curriculum, which
 * silently overwrote a different lesson whenever the target module already
 * held a same-titled row. This resolves the source and target rows directly and
 * writes the copy in a single insert.
 */
import { and, asc, eq, isNull, sql } from '@abugida/database'
import { courses, lessons, modules, quizOptions, quizzes } from '@abugida/database/catalog'
import { quizQuestions } from '@abugida/database/learning'
import { db } from '#/config/db.config'
import { requireAuthoringRole } from './courses.server-helpers.server'
import { resolveCopyTitle } from '../courses.duplication'
import type { DuplicateLessonInput, DuplicateLessonResult } from './courses.duplication'

/** Tag stamped on duplicated lessons so provenance is traceable. */
const COPY_TAG = 'source:copy'

/**
 * Next free sort position inside a module.
 *
 * `idx_lessons_module_order` is a UNIQUE index over (module_id, sort_order)
 * that includes soft-deleted rows, so the maximum must be taken over *all*
 * rows — not just the active ones — otherwise a duplicate can collide with a
 * previously deleted lesson's position.
 */
async function nextFreeLessonSortOrder(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  moduleId: number,
): Promise<number> {
  const rows = await tx
    .select({ max: sql<number>`COALESCE(MAX(${lessons.sortOrder}), -1)::int` })
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
  return (rows.at(0)?.max ?? -1) + 1
}

export async function duplicateLessonImpl(
  input: DuplicateLessonInput,
): Promise<DuplicateLessonResult> {
  const userId = await requireAuthoringRole()

  const sourceRows = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.publicId, input.lessonPublicId), isNull(lessons.deletedAt)))
    .limit(1)
  const source = sourceRows.at(0)
  if (!source) throw new Error('LESSON_NOT_FOUND')

  const targetModuleRows = await db
    .select()
    .from(modules)
    .where(and(eq(modules.publicId, input.targetModulePublicId), isNull(modules.deletedAt)))
    .limit(1)
  const targetModule = targetModuleRows.at(0)
  if (!targetModule) throw new Error('MODULE_NOT_FOUND')

  const targetCourseRows = await db
    .select({ publicId: courses.publicId })
    .from(courses)
    .where(and(eq(courses.id, targetModule.courseId), isNull(courses.deletedAt)))
    .limit(1)
  const targetCoursePublicId = targetCourseRows.at(0)?.publicId
  if (!targetCoursePublicId) throw new Error('COURSE_NOT_FOUND')

  // Titles already used inside the target module, so the copy never collides.
  const existingTitleRows = await db
    .select({ title: lessons.title })
    .from(lessons)
    .where(eq(lessons.moduleId, targetModule.id))
  const title = resolveCopyTitle(
    source.title,
    existingTitleRows.map((row) => row.title),
  )

  return db.transaction(async (tx) => {
    const sortOrder = await nextFreeLessonSortOrder(tx, targetModule.id)

    // Provenance: keep the source's tags and add the copy marker (max 10).
    const baseTags = Array.isArray(source.tags)
      ? source.tags.filter((t) => typeof t === 'string')
      : []
    const tags = Array.from(new Set([...baseTags, COPY_TAG])).slice(0, 10)

    const inserted = await tx
      .insert(lessons)
      .values({
        moduleId: targetModule.id,
        courseId: targetModule.courseId,
        instructorId: userId,
        title,
        description: source.description,
        contentType: source.contentType ?? 'video',
        // Media is referenced, never re-uploaded; body/file fields are optional.
        body: input.includeContent ? source.body : null,
        videoUrl: input.includeContent ? source.videoUrl : null,
        fileObjectKey: input.includeContent ? source.fileObjectKey : null,
        fileSizeBytes: input.includeContent ? source.fileSizeBytes : null,
        mimeType: input.includeContent ? source.mimeType : null,
        pageCount: input.includeContent ? source.pageCount : null,
        durationSeconds: source.durationSeconds,
        isDownloadable: source.isDownloadable,
        downloadSizeLimitBytes: source.downloadSizeLimitBytes,
        sortOrder,
        // A copy always starts as an unpublished draft.
        reviewStatus: 'draft',
        tags,
      })
      .returning({ id: lessons.id, publicId: lessons.publicId })
    const copy = inserted.at(0)
    if (!copy) throw new Error('LESSON_DUPLICATE_FAILED')

    let copiedQuiz = false
    if (input.includeQuiz) {
      copiedQuiz = await copyQuiz(tx, {
        sourceLessonId: source.id,
        newLessonId: copy.id,
        courseId: targetModule.courseId,
      })
    }

    return { lessonPublicId: copy.publicId, coursePublicId: targetCoursePublicId, copiedQuiz }
  })
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Clones the source lesson's quiz (if any) onto the new lesson, unpublished
 * and with `lessonId` re-pointed. Questions/options are keyed by lesson rather
 * than quiz, so they are copied explicitly and left unlinked from any attempts.
 */
async function copyQuiz(
  tx: Tx,
  input: { sourceLessonId: number; newLessonId: number; courseId: number },
): Promise<boolean> {
  const sourceQuizRows = await tx
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.lessonId, input.sourceLessonId), isNull(quizzes.deletedAt)))
    .limit(1)
  const sourceQuiz = sourceQuizRows.at(0)
  if (!sourceQuiz) return false

  const insertedQuiz = await tx
    .insert(quizzes)
    .values({
      courseId: input.courseId,
      lessonId: input.newLessonId,
      title: sourceQuiz.title,
      passingScorePercent: sourceQuiz.passingScorePercent,
      timeLimitMinutes: sourceQuiz.timeLimitMinutes,
      maxAttempts: sourceQuiz.maxAttempts,
      // Never carry over publication state of the original.
      isPublished: false,
    })
    .returning({ id: quizzes.id })

  const questionRows = await tx
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.lessonId, input.sourceLessonId))
    .orderBy(asc(quizQuestions.questionIndex))

  for (const question of questionRows) {
    const insertedQuestion = await tx
      .insert(quizQuestions)
      .values({
        lessonId: input.newLessonId,
        questionIndex: question.questionIndex,
        questionType: question.questionType,
        points: question.points,
        questionText: question.questionText,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      })
      .returning({ id: quizQuestions.id })
    const newQuestionId = insertedQuestion.at(0)?.id
    if (newQuestionId === undefined) continue

    const optionRows = await tx
      .select()
      .from(quizOptions)
      .where(eq(quizOptions.questionId, question.id))
      .orderBy(asc(quizOptions.optionIndex))
    if (optionRows.length === 0) continue

    await tx.insert(quizOptions).values(
      optionRows.map((option) => ({
        questionId: newQuestionId,
        optionIndex: option.optionIndex,
        optionText: option.optionText,
        isCorrect: option.isCorrect,
      })),
    )
  }

  void insertedQuiz
  return true
}
