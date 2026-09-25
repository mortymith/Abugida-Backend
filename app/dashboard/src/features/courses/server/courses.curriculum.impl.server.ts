/**
 * Server-only implementation of the curriculum builder (S-2.3 / S-2.6).
 * All mutations are authoring-role gated and re-validate server-side.
 */
import { and, asc, eq, inArray, isNull, ne, sql } from '@abugida/database'
import { courses, lessons, modules, quizzes, lessonUnlockRules } from '@abugida/database/catalog'
import { lessonCompletions } from '@abugida/database/learning'
import { db } from '#/config/db.config'
import {
  nextLessonSortOrder,
  nextModuleSortOrder,
  requireAuthoringRole,
  requireUserId,
  resolveCourse,
  resolveLesson,
} from './courses.server-helpers.server'
import { validateCurriculumTree } from '../courses.curriculum-tree'
import type { CurriculumSaveInput } from '../schemas/courses.authoring.schema'
import type { CurriculumDTO, CurriculumLessonDTO, CurriculumModuleDTO } from '../courses.types'

export async function getCurriculumImpl(coursePublicId: string): Promise<CurriculumDTO> {
  await requireUserId()
  const course = await resolveCourse(coursePublicId)

  const moduleRows = await db
    .select()
    .from(modules)
    .where(and(eq(modules.courseId, course.id), isNull(modules.deletedAt)))
    .orderBy(asc(modules.sortOrder), asc(modules.id))

  const lessonRows = moduleRows.length
    ? await db
        .select({
          id: lessons.id,
          publicId: lessons.publicId,
          moduleId: lessons.moduleId,
          title: lessons.title,
          sortOrder: lessons.sortOrder,
          contentType: lessons.contentType,
          reviewStatus: lessons.reviewStatus,
          body: lessons.body,
          videoUrl: lessons.videoUrl,
          durationSeconds: lessons.durationSeconds,
        })
        .from(lessons)
        .where(and(eq(lessons.courseId, course.id), isNull(lessons.deletedAt)))
        .orderBy(asc(lessons.sortOrder), asc(lessons.id))
    : []

  const lessonIds = lessonRows.map((lesson) => lesson.id)

  const [quizRows, unlockRows, completionRows] = await Promise.all([
    lessonIds.length
      ? db
          .select({ lessonId: quizzes.lessonId })
          .from(quizzes)
          .where(and(inArray(quizzes.lessonId, lessonIds), isNull(quizzes.deletedAt)))
      : Promise.resolve([] as Array<{ lessonId: number }>),
    lessonIds.length
      ? db
          .select({ lessonId: lessonUnlockRules.lessonId })
          .from(lessonUnlockRules)
          .where(inArray(lessonUnlockRules.lessonId, lessonIds))
      : Promise.resolve([] as Array<{ lessonId: number }>),
    lessonIds.length
      ? db
          .select({
            lessonId: lessonCompletions.lessonId,
            students: sql<number>`COUNT(DISTINCT ${lessonCompletions.studentId})::int`,
          })
          .from(lessonCompletions)
          .where(
            and(
              inArray(lessonCompletions.lessonId, lessonIds),
              eq(lessonCompletions.isCompleted, true),
            ),
          )
          .groupBy(lessonCompletions.lessonId)
      : Promise.resolve([] as Array<{ lessonId: number; students: number }>),
  ])

  const quizLessonIds = new Set(quizRows.map((row) => row.lessonId))
  const unlockLessonIds = new Set(unlockRows.map((row) => row.lessonId))
  const completionByLesson = new Map(completionRows.map((row) => [row.lessonId, row.students]))

  const lessonDtoById = new Map<number, CurriculumLessonDTO>()
  for (const lesson of lessonRows) {
    lessonDtoById.set(lesson.id, {
      id: lesson.id,
      publicId: lesson.publicId,
      title: lesson.title,
      sortOrder: lesson.sortOrder,
      contentType: lesson.contentType,
      reviewStatus: lesson.reviewStatus ?? 'draft',
      hasBody: Boolean(lesson.body && lesson.body.trim().length > 0),
      hasQuiz: quizLessonIds.has(lesson.id),
      hasUnlockRules: unlockLessonIds.has(lesson.id),
      studentCount: completionByLesson.get(lesson.id) ?? 0,
      videoUrl: lesson.videoUrl,
      durationMinutes:
        lesson.durationSeconds == null ? null : Math.round(lesson.durationSeconds / 60),
    })
  }

  const moduleDtos: CurriculumModuleDTO[] = moduleRows.map((module) => ({
    id: module.id,
    publicId: module.publicId,
    title: module.title,
    description: module.description,
    sortOrder: module.sortOrder,
    lessons: lessonRows
      .filter((lesson) => lesson.moduleId === module.id)
      .map((lesson) => lessonDtoById.get(lesson.id))
      .filter((lesson): lesson is CurriculumLessonDTO => lesson != null),
  }))

  return { coursePublicId: course.publicId, modules: moduleDtos }
}

async function refreshAndReturn(courseId: number, coursePublicId: string): Promise<CurriculumDTO> {
  await normalizeLessonOrder(courseId)
  await normalizeModuleOrderStandalone(courseId)
  return getCurriculumImpl(coursePublicId)
}

async function normalizeModuleOrderStandalone(courseId: number): Promise<void> {
  const rows = await db
    .select({ id: modules.id })
    .from(modules)
    .where(and(eq(modules.courseId, courseId), isNull(modules.deletedAt)))
    .orderBy(asc(modules.sortOrder), asc(modules.id))
  await Promise.all(
    rows.map((row, index) =>
      db
        .update(modules)
        .set({ sortOrder: index })
        .where(and(eq(modules.id, row.id), ne(modules.sortOrder, index))),
    ),
  )
}

async function normalizeLessonOrder(courseId: number): Promise<void> {
  const moduleRows = await db
    .select({ id: modules.id })
    .from(modules)
    .where(and(eq(modules.courseId, courseId), isNull(modules.deletedAt)))
  for (const module of moduleRows) {
    const lessonRows = await db
      .select({ id: lessons.id })
      .from(lessons)
      .where(and(eq(lessons.moduleId, module.id), isNull(lessons.deletedAt)))
      .orderBy(asc(lessons.sortOrder), asc(lessons.id))
    await Promise.all(
      lessonRows.map((lesson, index) =>
        db
          .update(lessons)
          .set({ sortOrder: index })
          .where(and(eq(lessons.id, lesson.id), ne(lessons.sortOrder, index))),
      ),
    )
  }
}

export async function createModuleImpl(input: {
  coursePublicId: string
  title: string
}): Promise<CurriculumDTO> {
  await requireAuthoringRole()
  const course = await resolveCourse(input.coursePublicId)
  await db.insert(modules).values({
    courseId: course.id,
    title: input.title.trim(),
    sortOrder: await nextModuleSortOrder(course.id),
  })
  return refreshAndReturn(course.id, course.publicId)
}

export async function renameModuleImpl(input: {
  modulePublicId: string
  title: string
}): Promise<CurriculumDTO> {
  await requireAuthoringRole()
  const rows = await db
    .select()
    .from(modules)
    .where(and(eq(modules.publicId, input.modulePublicId), isNull(modules.deletedAt)))
    .limit(1)
  const module = rows.at(0)
  if (!module) throw new Error('MODULE_NOT_FOUND')
  await db.update(modules).set({ title: input.title.trim() }).where(eq(modules.id, module.id))
  return refreshAndReturn(module.courseId, (await lookupCoursePublicId(module.courseId))!)
}

export async function deleteModuleImpl(input: { modulePublicId: string }): Promise<CurriculumDTO> {
  await requireAuthoringRole()
  const rows = await db
    .select()
    .from(modules)
    .where(and(eq(modules.publicId, input.modulePublicId), isNull(modules.deletedAt)))
    .limit(1)
  const module = rows.at(0)
  if (!module) throw new Error('MODULE_NOT_FOUND')

  // Spec: "Delete this module and all its lessons" — soft-delete both.
  await db.transaction(async (tx) => {
    const now = new Date()
    await tx
      .update(lessons)
      .set({ deletedAt: now })
      .where(and(eq(lessons.moduleId, module.id), isNull(lessons.deletedAt)))
    await tx.update(modules).set({ deletedAt: now }).where(eq(modules.id, module.id))
  })
  return refreshAndReturn(module.courseId, (await lookupCoursePublicId(module.courseId))!)
}

export async function createLessonImpl(input: {
  modulePublicId: string
  title: string
}): Promise<CurriculumDTO> {
  const userId = await requireAuthoringRole()
  const rows = await db
    .select()
    .from(modules)
    .where(and(eq(modules.publicId, input.modulePublicId), isNull(modules.deletedAt)))
    .limit(1)
  const module = rows.at(0)
  if (!module) throw new Error('MODULE_NOT_FOUND')
  await db.insert(lessons).values({
    moduleId: module.id,
    courseId: module.courseId,
    instructorId: userId,
    title: input.title.trim(),
    contentType: 'video',
    sortOrder: await nextLessonSortOrder(module.id),
    reviewStatus: 'draft',
  })
  return refreshAndReturn(module.courseId, (await lookupCoursePublicId(module.courseId))!)
}

export async function renameLessonImpl(input: {
  lessonPublicId: string
  title: string
}): Promise<CurriculumDTO> {
  await requireAuthoringRole()
  const lesson = await resolveLesson(input.lessonPublicId)
  await db.update(lessons).set({ title: input.title.trim() }).where(eq(lessons.id, lesson.id))
  return refreshAndReturn(lesson.courseId, (await lookupCoursePublicId(lesson.courseId))!)
}

export async function deleteLessonImpl(input: { lessonPublicId: string }): Promise<CurriculumDTO> {
  await requireAuthoringRole()
  const lesson = await resolveLesson(input.lessonPublicId)
  await db.update(lessons).set({ deletedAt: new Date() }).where(eq(lessons.id, lesson.id))
  return refreshAndReturn(lesson.courseId, (await lookupCoursePublicId(lesson.courseId))!)
}

export async function saveCurriculumOrderImpl(input: CurriculumSaveInput): Promise<CurriculumDTO> {
  await requireAuthoringRole()
  const course = await resolveCourse(input.coursePublicId)

  const existingModules = await db
    .select({ publicId: modules.publicId })
    .from(modules)
    .where(and(eq(modules.courseId, course.id), isNull(modules.deletedAt)))
  const existingLessons = await db
    .select({ publicId: lessons.publicId })
    .from(lessons)
    .where(and(eq(lessons.courseId, course.id), isNull(lessons.deletedAt)))
  const moduleIds = new Set(existingModules.map((row) => row.publicId))
  const lessonIds = new Set(existingLessons.map((row) => row.publicId))

  // Every payload node must exist on this course (no cross-course injection).
  for (const module of input.modules) {
    if (!moduleIds.has(module.publicId)) throw new Error('MODULE_NOT_FOUND')
    for (const lesson of module.lessons) {
      if (!lessonIds.has(lesson.publicId)) throw new Error('LESSON_NOT_FOUND')
    }
  }

  const validation = validateCurriculumTree({
    modules: input.modules.map((module) => ({
      publicId: module.publicId,
      title: module.title,
      lessons: module.lessons.map((lesson) => ({
        publicId: lesson.publicId,
        title: lesson.title,
        modulePublicId: module.publicId,
      })),
    })),
  })
  if (!validation.ok) {
    throw new Error(`CURRICULUM_INVALID: ${validation.errors[0] ?? 'invalid curriculum'}`)
  }

  const moduleIdRows = await db
    .select({ publicId: modules.publicId, id: modules.id })
    .from(modules)
    .where(and(eq(modules.courseId, course.id), isNull(modules.deletedAt)))
  const internalModuleId = new Map(moduleIdRows.map((row) => [row.publicId, row.id]))

  await db.transaction(async (tx) => {
    for (const [moduleIndex, module] of input.modules.entries()) {
      const internalId = internalModuleId.get(module.publicId)
      if (!internalId) throw new Error('MODULE_NOT_FOUND')
      await tx
        .update(modules)
        .set({ title: module.title.trim(), sortOrder: moduleIndex })
        .where(eq(modules.publicId, module.publicId))
      for (const [lessonIndex, lesson] of module.lessons.entries()) {
        const lessonRows = await tx
          .select({ id: lessons.id })
          .from(lessons)
          .where(eq(lessons.publicId, lesson.publicId))
          .limit(1)
        const lessonId = lessonRows.at(0)?.id
        if (!lessonId) continue
        await tx
          .update(lessons)
          .set({ title: lesson.title.trim(), moduleId: internalId, sortOrder: lessonIndex })
          .where(eq(lessons.id, lessonId))
      }
    }
  })

  return refreshAndReturn(course.id, course.publicId)
}

async function lookupCoursePublicId(courseId: number): Promise<string | null> {
  const rows = await db
    .select({ publicId: courses.publicId })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1)
  return rows.at(0)?.publicId ?? null
}
