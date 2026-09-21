/**
 * Server-only implementation of S-2.12 Template Library.
 */
import { and, asc, eq, ilike, isNull, or, sql } from '@abugida/database'
import {
  courses,
  courseTemplates,
  examTypes,
  lessons,
  modules,
  quizOptions,
  quizzes,
} from '@abugida/database/catalog'
import { quizQuestions } from '@abugida/database/learning'
import { db } from '#/config/db.config'
import {
  escapeLike,
  requireAuthoringRole,
  resolveCourse,
  slugifyTitle,
} from './courses.server-helpers.server'
import type { TemplateQuery } from '../schemas/courses.workflow.schema'
import type { CourseTemplateDTO, TemplateStructure } from '../courses.types'

export async function getCourseTemplatesImpl(data: TemplateQuery): Promise<CourseTemplateDTO[]> {
  await requireAuthoringRole()

  const filters = [eq(courseTemplates.isActive, true), isNull(courseTemplates.deletedAt)]
  if (data.category !== 'all') filters.push(eq(courseTemplates.category, data.category))
  if (data.search && data.search.trim()) {
    const pattern = `%${escapeLike(data.search.trim())}%`
    filters.push(
      or(ilike(courseTemplates.name, pattern), ilike(courseTemplates.description, pattern)) ??
        isNull(courseTemplates.id),
    )
  }

  const rows = await db
    .select()
    .from(courseTemplates)
    .where(and(...filters))
    .orderBy(sql`${courseTemplates.isFeatured} DESC`, asc(courseTemplates.name))
    .limit(60)

  return rows.map((row) => ({
    publicId: row.publicId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category,
    moduleCount: row.moduleCount,
    lessonCount: row.lessonCount,
    quizCount: row.quizCount,
    isFeatured: row.isFeatured,
    structure: row.structure as TemplateStructure,
  }))
}

export async function useTemplateImpl(
  templatePublicId: string,
): Promise<{ coursePublicId: string }> {
  const userId = await requireAuthoringRole()

  const rows = await db
    .select()
    .from(courseTemplates)
    .where(and(eq(courseTemplates.publicId, templatePublicId), isNull(courseTemplates.deletedAt)))
    .limit(1)
  const template = rows.at(0)
  if (!template) throw new Error('TEMPLATE_NOT_FOUND')

  const structure = template.structure as TemplateStructure
  const examTypeId = await firstExamTypeIdOrSeed()

  const title = `${template.name} Course`.slice(0, 300)
  const slug = await uniqueSlug(slugifyTitle(title))

  const coursePublicId = await db.transaction(async (tx) => {
    const insertedCourse = await tx
      .insert(courses)
      .values({
        title,
        slug,
        description: template.description,
        examTypeId,
        instructorId: userId,
        pricingModel: 'free',
        isFree: true,
        status: 'draft',
      })
      .returning({ publicId: courses.publicId, id: courses.id })
    const course = insertedCourse.at(0)!
    if (!course.publicId) throw new Error('COURSE_CREATE_FAILED')

    let lessonCount = 0
    let quizCount = 0
    for (const [moduleIndex, module] of structure.modules.entries()) {
      const insertedModule = await tx
        .insert(modules)
        .values({
          courseId: course.id,
          instructorId: userId,
          title: module.title,
          description: module.description,
          sortOrder: moduleIndex,
        })
        .returning({ id: modules.id })
      const moduleId = insertedModule.at(0)!.id

      for (const [lessonIndex, lesson] of module.lessons.entries()) {
        const insertedLesson = await tx
          .insert(lessons)
          .values({
            moduleId,
            courseId: course.id,
            instructorId: userId,
            title: lesson.title,
            description: null,
            contentType: lesson.contentType,
            body: lesson.body,
            videoUrl: lesson.videoUrl,
            sortOrder: lessonIndex,
            tags: ['source:template'],
          })
          .returning({ id: lessons.id })
        lessonCount += 1
        const lessonId = insertedLesson.at(0)!.id

        if (lesson.quizSeed) {
          const insertedQuiz = await tx
            .insert(quizzes)
            .values({
              courseId: course.id,
              lessonId,
              title: `${lesson.title} — Quiz`,
              passingScorePercent: 70,
            })
            .returning({ id: quizzes.id })
          const quizId = insertedQuiz.at(0)!.id
          const insertedQuestion = await tx
            .insert(quizQuestions)
            .values({
              lessonId,
              questionIndex: 0,
              questionType: lesson.quizSeed.options.length > 0 ? 'multiple_choice' : 'short_answer',
              points: 10,
              questionText: lesson.quizSeed.questionText,
              correctAnswer: lesson.quizSeed.correctAnswer,
              explanation: null,
            })
            .returning({ id: quizQuestions.id })
          const questionId = insertedQuestion.at(0)!.id
          if (lesson.quizSeed.options.length > 0) {
            await tx.insert(quizOptions).values(
              lesson.quizSeed.options.map((optionText, optionIndex) => ({
                questionId,
                optionIndex,
                optionText,
                isCorrect: optionText === lesson.quizSeed!.correctAnswer,
              })),
            )
          }
          void quizId
          quizCount += 1
        }
      }
    }

    await tx
      .update(courseTemplates)
      .set({ moduleCount: structure.modules.length, lessonCount, quizCount })
      .where(eq(courseTemplates.id, template.id))

    return course.publicId
  })

  return { coursePublicId }
}

export async function saveCourseAsTemplateImpl(input: {
  coursePublicId: string
  name: string
  category: string
}): Promise<{ templatePublicId: string }> {
  await requireAuthoringRole()
  const course = await resolveCourse(input.coursePublicId)

  const moduleRows = await db
    .select()
    .from(modules)
    .where(and(eq(modules.courseId, course.id), isNull(modules.deletedAt)))
    .orderBy(modules.sortOrder)

  const lessonRows = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.courseId, course.id), isNull(lessons.deletedAt)))
    .orderBy(lessons.sortOrder)

  const quizRows = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.courseId, course.id), isNull(quizzes.deletedAt)))

  const structure: TemplateStructure = {
    modules: moduleRows.map((module) => ({
      title: module.title,
      description: module.description,
      lessons: lessonRows
        .filter((lesson) => lesson.moduleId === module.id)
        .map((lesson) => {
          const quiz = quizRows.find((row) => row.lessonId === lesson.id)
          return {
            title: lesson.title,
            contentType: lesson.contentType ?? 'video',
            body: lesson.body,
            videoUrl: lesson.videoUrl,
            durationMinutes:
              lesson.durationSeconds == null ? null : Math.round(lesson.durationSeconds / 60),
            quizSeed: quiz
              ? { questionText: `${lesson.title} check`, correctAnswer: '', options: [] }
              : null,
          }
        }),
    })),
  }

  const slug = await uniqueSlug(slugifyTitle(input.name))
  const inserted = await db
    .insert(courseTemplates)
    .values({
      name: input.name.trim(),
      slug,
      description: course.description,
      category: input.category,
      structure,
      moduleCount: structure.modules.length,
      lessonCount: lessonRows.length,
      quizCount: quizRows.length,
    })
    .returning({ publicId: courseTemplates.publicId })

  const templatePublicId = inserted.at(0)?.publicId
  if (!templatePublicId) throw new Error('TEMPLATE_CREATE_FAILED')
  return { templatePublicId }
}

async function firstExamTypeIdOrSeed(): Promise<number> {
  const rows = await db
    .select({ id: examTypes.id })
    .from(examTypes)
    .where(and(eq(examTypes.isActive, true), isNull(examTypes.deletedAt)))
    .limit(1)
  const found = rows.at(0)?.id
  if (found) return found
  const inserted = await db
    .insert(examTypes)
    .values({ name: 'General', slug: `general-${Date.now().toString(36)}` })
    .returning({ id: examTypes.id })
  const id = inserted.at(0)?.id
  if (!id) throw new Error('EXAM_TYPE_UNAVAILABLE')
  return id
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base || 'template'
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const rows = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, candidate))
      .limit(1)
    if (rows.length === 0) return candidate
    candidate = `${base}-${attempt + 2}`
  }
  return `${base}-${Date.now().toString(36)}`
}
