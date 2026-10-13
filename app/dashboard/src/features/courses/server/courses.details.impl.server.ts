/**
 * Server-only implementation of course details (S-2.2).
 */
import { and, eq, isNull } from '@abugida/database'
import { courses, examTypes } from '@abugida/database/catalog'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  requireActiveOrganizationId,
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
    // The fifth lifecycle state is derived from this timestamp, not stored as
    // its own `status` value — see `deriveCourseLifecycleState`.
    approvedAt: row.approvedAt?.toISOString() ?? null,
    slug: row.slug,
    requiresApproval: row.requiresApproval,
    scheduledPublishAt: row.scheduledPublishAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    enrollmentStartAt: row.enrollmentStartAt?.toISOString() ?? null,
    enrollmentEndAt: row.enrollmentEndAt?.toISOString() ?? null,
    isFree: row.isFree,
    priceAmount: row.priceAmount,
    priceCurrency: row.priceCurrency,
    // NOT NULL with an `en` default (S-2.20), so a row always has one.
    contentLanguage: row.contentLanguage,
    version: row.version,
    rowVersion: row.rowVersion,
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
      // A course belongs to the workspace it was created in (spec 13); this is
      // what every later read is scoped by.
      organizationId: await requireActiveOrganizationId(),
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

/**
 * S-2.6 inline title save.
 *
 * Enforces the Field Lock table server-side. The UI disables the control for an
 * Approved course, but a client that skips the UI must not be able to write the
 * field anyway — "permission checks are server-side; hiding a control is
 * convenience, not security."
 *
 * A title edit also **clears `approved_at`**: spec 04, "any edit clears
 * `approved_at`, which is how Approved falls back to Draft." Doing it here
 * rather than in the UI means the derived fifth state can never disagree with
 * storage, whichever entry point wrote the title.
 *
 * The slug is deliberately left alone. Spec 04: "regenerated only while
 * `status = 'draft'`; once published the slug is frozen and changing the title
 * cannot break inbound links."
 */
export async function saveCourseTitleImpl(input: {
  coursePublicId: string
  title: string
}): Promise<{ coursePublicId: string; slugRegenerated: boolean }> {
  await requireAuthoringRole()
  const course = await resolveCourse(input.coursePublicId)

  if (course.status === 'archived') {
    throw new Error('COURSE_ARCHIVED: restore the course before editing')
  }
  // `resolveCourse` returns the raw row, so `approvedAt` is a `Date`, not the
  // DTO's ISO string.
  if (course.approvedAt != null) {
    throw new Error('COURSE_APPROVED: withdraw the approval before editing the title')
  }

  const newTitle = input.title.trim()
  if (newTitle === course.title) {
    return { coursePublicId: course.publicId, slugRegenerated: false }
  }

  // Only a Draft regenerates the slug. A published course's inbound links
  // depend on the slug staying put.
  const slugRegenerated = course.status === 'draft'
  const slug = slugRegenerated ? await uniqueCourseSlug(slugifyTitle(newTitle)) : course.slug

  await db
    .update(courses)
    .set({
      title: newTitle,
      slug,
      // Any edit clears the approval. Unreachable while `approvedAt` is set
      // (refused above), but stated explicitly so the invariant holds if the
      // guard above is ever relaxed for a legitimate flow.
      approvedAt: null,
    })
    .where(eq(courses.id, course.id))

  return { coursePublicId: course.publicId, slugRegenerated }
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
