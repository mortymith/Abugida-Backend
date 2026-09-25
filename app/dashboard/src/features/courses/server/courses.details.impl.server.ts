/**
 * Server-only implementation of course details (S-2.2).
 */
import { and, eq, isNull } from '@abugida/database'
import { courses, examTypes } from '@abugida/database/catalog'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  requireAuthoringRole,
  requireUserId,
  resolveCourse,
  slugifyTitle,
  uniqueCourseSlug,
} from './courses.server-helpers.server'
import type { CourseDetails } from '../schemas/courses.authoring.schema'
import type { CourseDetailsDTO } from '../courses.types'

type CourseRow = typeof courses.$inferSelect

function toDto(
  row: CourseRow,
  examTypeName: string | null,
  instructorName: string | null,
): CourseDetailsDTO {
  return {
    publicId: row.publicId,
    title: row.title,
    description: row.description,
    examTypeId: row.examTypeId,
    examTypeName,
    instructorId: row.instructorId,
    instructorName,
    courseType: row.courseType ?? 'self_paced',
    level: row.level,
    thumbnailObjectKey: row.thumbnailObjectKey,
    status: row.status ?? 'draft',
    slug: row.slug,
    requiresApproval: row.requiresApproval,
    scheduledPublishAt: row.scheduledPublishAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    enrollmentStartAt: row.enrollmentStartAt?.toISOString() ?? null,
    enrollmentEndAt: row.enrollmentEndAt?.toISOString() ?? null,
    isFree: row.isFree,
    priceAmount: row.priceAmount,
    priceCurrency: row.priceCurrency,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getCourseDetailsImpl(coursePublicId: string): Promise<CourseDetailsDTO> {
  await requireUserId()
  const course = await resolveCourse(coursePublicId)

  const [examTypeRow, instructorRow] = await Promise.all([
    db
      .select({ name: examTypes.name })
      .from(examTypes)
      .where(eq(examTypes.id, course.examTypeId))
      .limit(1),
    course.instructorId
      ? db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, course.instructorId))
          .limit(1)
      : Promise.resolve([] as Array<{ name: string }>),
  ])

  return toDto(course, examTypeRow.at(0)?.name ?? null, instructorRow.at(0)?.name ?? null)
}

export async function createCourseDraftImpl(
  input: Partial<CourseDetails> & { title: string },
): Promise<{ coursePublicId: string }> {
  const userId = await requireAuthoringRole()

  const examTypeId =
    input.examTypeId ?? (await firstActiveExamTypeId()) ?? (await ensureDefaultExamType())

  const slug = await uniqueCourseSlug(slugifyTitle(input.title))
  const inserted = await db
    .insert(courses)
    .values({
      title: input.title.trim(),
      slug,
      description: (input.description ?? '').trim() || null,
      examTypeId,
      instructorId: input.instructorId ?? userId,
      courseType: input.courseType ?? 'self_paced',
      level: input.level ?? null,
      thumbnailObjectKey: input.thumbnailObjectKey ?? null,
      pricingModel: 'free',
      isFree: true,
      status: 'draft',
    })
    .returning({ publicId: courses.publicId })

  const publicId = inserted.at(0)?.publicId
  if (!publicId) throw new Error('COURSE_CREATE_FAILED')
  return { coursePublicId: publicId }
}

export async function saveCourseDetailsImpl(
  input: CourseDetails & { coursePublicId: string },
): Promise<{ coursePublicId: string }> {
  await requireAuthoringRole()
  const course = await resolveCourse(input.coursePublicId)

  const newTitle = input.title.trim()
  const slug =
    course.title === newTitle ? course.slug : await uniqueCourseSlug(slugifyTitle(newTitle))

  await db
    .update(courses)
    .set({
      title: newTitle,
      slug,
      description: input.description.trim() || null,
      examTypeId: input.examTypeId,
      instructorId: input.instructorId,
      courseType: input.courseType,
      level: input.level,
      thumbnailObjectKey: input.thumbnailObjectKey,
    })
    .where(eq(courses.id, course.id))

  return { coursePublicId: course.publicId }
}

async function firstActiveExamTypeId(): Promise<number | null> {
  const rows = await db
    .select({ id: examTypes.id })
    .from(examTypes)
    .where(and(eq(examTypes.isActive, true), isNull(examTypes.deletedAt)))
    .limit(1)
  return rows.at(0)?.id ?? null
}

/** Spec categories (TOEFL/IELTS/GRE/Other) — seed the first one if absent. */
async function ensureDefaultExamType(): Promise<number> {
  const inserted = await db
    .insert(examTypes)
    .values({ name: 'General', slug: `general-${Date.now().toString(36)}` })
    .returning({ id: examTypes.id })
  const id = inserted.at(0)?.id
  if (!id) throw new Error('EXAM_TYPE_UNAVAILABLE')
  return id
}
