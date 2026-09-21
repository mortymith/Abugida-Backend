/**
 * Server-only implementation of S-2.15 Prerequisites & Unlock Rules.
 * Circular dependency detection runs server-side before every save.
 */
import { and, asc, eq, isNull, ne } from '@abugida/database'
import { alias } from 'drizzle-orm/pg-core'
import { courses, lessons, lessonUnlockRules, quizzes } from '@abugida/database/catalog'
import { db } from '#/config/db.config'
import { requireAuthoringRole, resolveLesson } from './courses.server-helpers.server'
import { detectUnlockCycle } from '../courses.unlock-cycle'
import type { UnlockRulesSaveInput } from '../schemas/courses.learning.schema'
import type { UnlockRulesDTO } from '../courses.types'

const requiredLessonAlias = alias(lessons, 'required_lesson')
const lockedLessonAlias = alias(lessons, 'locked_lesson')

async function requireCourse(courseId: number) {
  const rows = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), isNull(courses.deletedAt)))
    .limit(1)
  const course = rows.at(0)
  if (!course) throw new Error('COURSE_NOT_FOUND')
  return course
}

export async function getUnlockRulesImpl(lessonPublicId: string): Promise<UnlockRulesDTO> {
  await requireAuthoringRole()
  const lesson = await resolveLesson(lessonPublicId)
  const course = await requireCourse(lesson.courseId)

  const [ruleRows, candidateRows, quizRows] = await Promise.all([
    db
      .select({
        rule: lessonUnlockRules,
        requiredTitle: requiredLessonAlias.title,
        requiredPublicId: requiredLessonAlias.publicId,
      })
      .from(lessonUnlockRules)
      .innerJoin(
        requiredLessonAlias,
        eq(requiredLessonAlias.id, lessonUnlockRules.requiredLessonId),
      )
      .where(eq(lessonUnlockRules.lessonId, lesson.id))
      .orderBy(asc(lessonUnlockRules.id)),
    db
      .select({ publicId: lessons.publicId, title: lessons.title, id: lessons.id })
      .from(lessons)
      .where(
        and(eq(lessons.courseId, course.id), isNull(lessons.deletedAt), ne(lessons.id, lesson.id)),
      )
      .orderBy(asc(lessons.sortOrder)),
    db.select({ lessonId: quizzes.lessonId }).from(quizzes).where(isNull(quizzes.deletedAt)),
  ])

  const quizLessonIds = new Set(quizRows.map((row) => row.lessonId))

  return {
    lessonPublicId: lesson.publicId,
    lessonTitle: lesson.title,
    enabled: ruleRows.length > 0,
    lockBehavior: ruleRows.at(0)?.rule.lockBehavior ?? 'visible_locked',
    customMessage: ruleRows.at(0)?.rule.customMessage ?? null,
    rules: ruleRows.map((row) => ({
      publicId: row.rule.publicId,
      requiredLessonPublicId: row.requiredPublicId,
      requiredLessonTitle: row.requiredTitle,
      condition: row.rule.condition,
      thresholdPercent: row.rule.thresholdPercent,
      hasQuiz: quizLessonIds.has(row.rule.requiredLessonId),
    })),
    candidateRequirements: candidateRows.map((row) => ({
      lessonPublicId: row.publicId,
      lessonTitle: row.title,
      hasQuiz: quizLessonIds.has(row.id),
    })),
  }
}

export async function saveUnlockRulesImpl(
  input: UnlockRulesSaveInput,
): Promise<
  | { ok: true; rules: UnlockRulesDTO }
  | { ok: false; reason: 'cycle'; cycleLessonPublicIds: string[] }
> {
  await requireAuthoringRole()
  const lesson = await resolveLesson(input.lessonPublicId)
  const course = await requireCourse(lesson.courseId)

  const requirementRows = input.enabled ? input.requirements : []
  if (input.enabled && requirementRows.length === 0) {
    throw new Error('RULES_EMPTY: add at least one requirement or turn the toggle off')
  }

  const courseLessonRows = await db
    .select({ id: lessons.id, publicId: lessons.publicId })
    .from(lessons)
    .where(and(eq(lessons.courseId, course.id), isNull(lessons.deletedAt)))
  const idByPublicId = new Map(courseLessonRows.map((row) => [row.publicId, row.id]))

  for (const requirement of requirementRows) {
    if (requirement.requiredLessonPublicId === lesson.publicId) {
      throw new Error('RULES_SELF: a lesson cannot require itself')
    }
    if (!idByPublicId.has(requirement.requiredLessonPublicId)) {
      throw new Error('LESSON_NOT_FOUND')
    }
    if (requirement.condition === 'quiz_score' && requirement.thresholdPercent == null) {
      throw new Error('RULES_THRESHOLD: quiz-score requirements need a 1-100% threshold')
    }
  }

  const proposedEdges = requirementRows.map((requirement) => ({
    lessonId: lesson.publicId,
    requiredLessonId: requirement.requiredLessonPublicId,
  }))

  // Existing edges for every OTHER lesson in this course (public-id graph).
  const otherRules = await db
    .select({
      lockedPublicId: lockedLessonAlias.publicId,
      requiredPublicId: requiredLessonAlias.publicId,
    })
    .from(lessonUnlockRules)
    .innerJoin(lockedLessonAlias, eq(lockedLessonAlias.id, lessonUnlockRules.lessonId))
    .innerJoin(requiredLessonAlias, eq(requiredLessonAlias.id, lessonUnlockRules.requiredLessonId))
    .where(
      and(eq(lessonUnlockRules.courseId, course.id), ne(lessonUnlockRules.lessonId, lesson.id)),
    )

  const existingEdges = otherRules.map((row) => ({
    lessonId: row.lockedPublicId,
    requiredLessonId: row.requiredPublicId,
  }))

  const cycleCheck = detectUnlockCycle(proposedEdges, existingEdges)
  if (!cycleCheck.ok) {
    return { ok: false, reason: 'cycle', cycleLessonPublicIds: cycleCheck.cycle }
  }

  await db.transaction(async (tx) => {
    await tx.delete(lessonUnlockRules).where(eq(lessonUnlockRules.lessonId, lesson.id))
    if (requirementRows.length > 0) {
      await tx.insert(lessonUnlockRules).values(
        requirementRows.map((requirement) => ({
          courseId: course.id,
          lessonId: lesson.id,
          requiredLessonId: idByPublicId.get(requirement.requiredLessonPublicId)!,
          condition: requirement.condition,
          thresholdPercent: requirement.thresholdPercent,
          lockBehavior: input.lockBehavior,
          customMessage: input.customMessage?.trim() || null,
        })),
      )
    }
  })

  return { ok: true, rules: await getUnlockRulesImpl(lesson.publicId) }
}
