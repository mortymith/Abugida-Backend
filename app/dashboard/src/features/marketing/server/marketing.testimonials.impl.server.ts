/**
 * Server-only implementation of S-8.5 Student Testimonials: the consent-first
 * moderation queue (approve / light-edit / reject), manual collection,
 * collection triggers and landing-page display settings, featuring with
 * S-7.1-grade safeguards, student notification on publish, and the privacy
 * rule that anonymized (deleted) students' testimonials stay unlisted.
 * Never import from client code.
 */
import { and, desc, eq, inArray, isNull, sql } from '@abugida/database'
import { testimonialRequests, testimonials } from '@abugida/database/marketing'
import { courses, courseStats } from '@abugida/database/catalog'
import { users } from '@abugida/database/auth'
import { courseReviews } from '@abugida/database/learning'
import { db } from '#/config/db.config'
import {
  DEFAULT_TESTIMONIAL_SETTINGS,
  readMarketingConfig,
  requireMarketingReadRole,
  requireModerationRole,
  requireMarketingWriteRole,
  writeMarketingAudit,
  writeMarketingConfig,
  TESTIMONIAL_SETTINGS_CONFIG_KEY,
} from './marketing.server-helpers.server'
import type { TestimonialSettingsConfig } from './marketing.server-helpers.server'
import { createNotifications } from '#/features/courses/server/courses.server-helpers.server'
import { isAuthorActive, isHeavyEdit, validateModeration } from '../marketing.testimonial-rules'
import type {
  TestimonialCollectInput,
  TestimonialDecisionInput,
  TestimonialFeatureInput,
  TestimonialQueryInput,
  TestimonialSettingsInput,
} from '../schemas/marketing.schema'
import type { TestimonialRequestRow, TestimonialRow, TestimonialSettings } from '../marketing.types'

async function resolveTestimonial(testimonialPublicId: string) {
  const rows = await db
    .select()
    .from(testimonials)
    .where(eq(testimonials.publicId, testimonialPublicId))
    .limit(1)
  const testimonial = rows.at(0)
  if (!testimonial) throw new Error('TESTIMONIAL_NOT_FOUND')
  return testimonial
}

function baseTestimonialSelect() {
  return db
    .select({
      publicId: testimonials.publicId,
      studentId: testimonials.studentId,
      studentName: users.name,
      accountStatus: users.accountStatus,
      studentDeletedAt: users.deletedAt,
      coursePublicId: courses.publicId,
      courseTitle: courses.title,
      courseRating: courseStats.averageRating,
      quote: testimonials.quote,
      rating: testimonials.rating,
      consentConfirmed: testimonials.consentConfirmed,
      status: testimonials.status,
      featured: testimonials.featured,
      heavyEdit: testimonials.heavyEdit,
      editNote: testimonials.editNote,
      rejectionReason: testimonials.rejectionReason,
      trigger: testimonials.trigger,
      publishedAt: testimonials.publishedAt,
      createdAt: testimonials.createdAt,
    })
    .from(testimonials)
    .innerJoin(users, eq(users.id, testimonials.studentId))
    .innerJoin(courses, eq(courses.id, testimonials.courseId))
    .leftJoin(courseStats, eq(courseStats.courseId, testimonials.courseId))
}

export async function listTestimonialsImpl(
  query: TestimonialQueryInput,
): Promise<{ items: TestimonialRow[] }> {
  await requireMarketingReadRole()

  const rows = await (query.status === 'published'
    ? baseTestimonialSelect()
        .where(
          and(
            eq(testimonials.status, 'published'),
            query.course !== 'all' ? eq(courses.publicId, query.course) : undefined,
          ),
        )
        .orderBy(desc(testimonials.featured), desc(testimonials.publishedAt))
        .limit(100)
    : baseTestimonialSelect()
        // Pending queue sorted by rating and course (spec S-8.5).
        .where(
          and(
            eq(testimonials.status, 'pending'),
            query.course !== 'all' ? eq(courses.publicId, query.course) : undefined,
          ),
        )
        .orderBy(desc(testimonials.rating), courses.title)
        .limit(100))

  return {
    items: rows.map((row) => ({
      publicId: row.publicId,
      studentId: row.studentId,
      studentName: row.studentName ?? 'Unknown student',
      coursePublicId: row.coursePublicId,
      courseTitle: row.courseTitle,
      courseRating: row.courseRating == null ? null : Number(row.courseRating),
      quote: row.quote,
      rating: row.rating,
      consentConfirmed: row.consentConfirmed,
      status: row.status,
      featured: row.featured,
      heavyEdit: row.heavyEdit,
      editNote: row.editNote,
      rejectionReason: row.rejectionReason,
      trigger: row.trigger,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  }
}

export async function getTestimonialSettingsImpl(): Promise<{
  settings: TestimonialSettings
  displayFormat: TestimonialSettings['displayFormat']
}> {
  await requireMarketingReadRole()
  const stored = await readMarketingConfig<TestimonialSettingsConfig>(
    TESTIMONIAL_SETTINGS_CONFIG_KEY,
    DEFAULT_TESTIMONIAL_SETTINGS,
  )
  return {
    settings: {
      onCompletion: stored.onCompletion,
      onFiveStar: stored.onFiveStar,
      displayFormat: stored.displayFormat,
    },
    displayFormat: stored.displayFormat,
  }
}

export async function saveTestimonialSettingsImpl(
  input: TestimonialSettingsInput,
): Promise<{ ok: true }> {
  const userId = await requireMarketingWriteRole()
  await writeMarketingConfig(
    TESTIMONIAL_SETTINGS_CONFIG_KEY,
    input,
    'Testimonial collection triggers and landing-page display format (S-8.5)',
  )
  await writeMarketingAudit({
    actorId: userId,
    entity: 'testimonial',
    action: 'update_settings',
    metadata: { ...input },
  })
  return { ok: true }
}

/**
 * Automated collection requests (S-8.5 trigger 1): when enabled, students
 * completing a course or leaving a 5-star rating receive one open request
 * per course. Exposed for the completion/rating flows to invoke.
 */
export async function requestTestimonialImpl(input: {
  studentId: string
  courseId: number
  trigger: 'completion' | 'five_star_rating'
}): Promise<void> {
  const settings = await readMarketingConfig<TestimonialSettingsConfig>(
    TESTIMONIAL_SETTINGS_CONFIG_KEY,
    DEFAULT_TESTIMONIAL_SETTINGS,
  )
  if (input.trigger === 'completion' && !settings.onCompletion) return
  if (input.trigger === 'five_star_rating' && !settings.onFiveStar) return

  const existing = await db
    .select({ id: testimonialRequests.id })
    .from(testimonialRequests)
    .where(
      and(
        eq(testimonialRequests.studentId, input.studentId),
        eq(testimonialRequests.courseId, input.courseId),
        eq(testimonialRequests.status, 'open'),
      ),
    )
    .limit(1)
  if (existing.length > 0) return

  await db.insert(testimonialRequests).values({
    studentId: input.studentId,
    courseId: input.courseId,
    trigger: input.trigger,
  })
}

export async function listTestimonialRequestsImpl(): Promise<{
  items: TestimonialRequestRow[]
}> {
  await requireMarketingReadRole()

  const rows = await db
    .select({
      publicId: testimonialRequests.publicId,
      studentName: users.name,
      courseTitle: courses.title,
      trigger: testimonialRequests.trigger,
      status: testimonialRequests.status,
      requestedAt: testimonialRequests.requestedAt,
    })
    .from(testimonialRequests)
    .innerJoin(users, eq(users.id, testimonialRequests.studentId))
    .innerJoin(courses, eq(courses.id, testimonialRequests.courseId))
    .where(eq(testimonialRequests.status, 'open'))
    .orderBy(desc(testimonialRequests.requestedAt))
    .limit(50)

  return {
    items: rows.map((row) => ({
      publicId: row.publicId,
      studentName: row.studentName ?? 'Unknown student',
      courseTitle: row.courseTitle,
      trigger: row.trigger,
      status: row.status,
      requestedAt: row.requestedAt.toISOString(),
    })),
  }
}

export async function collectTestimonialManuallyImpl(
  input: TestimonialCollectInput,
): Promise<{ testimonialPublicId: string }> {
  const userId = await requireMarketingWriteRole()

  const courseRows = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.publicId, input.coursePublicId))
    .limit(1)
  const courseId = courseRows.at(0)?.id
  if (!courseId) throw new Error('COURSE_NOT_FOUND')

  const studentRows = await db
    .select({ id: users.id, accountStatus: users.accountStatus, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, input.studentId))
    .limit(1)
  const student = studentRows.at(0)
  if (!student) throw new Error('STUDENT_NOT_FOUND')

  const inserted = await db
    .insert(testimonials)
    .values({
      studentId: input.studentId,
      courseId,
      quote: input.quote,
      rating: input.rating ?? null,
      consentConfirmed: input.consentConfirmed,
      status: 'pending',
      trigger: 'manual',
    })
    .returning({ publicId: testimonials.publicId })

  const publicId = inserted.at(0)?.publicId
  if (!publicId) throw new Error('TESTIMONIAL_CREATE_FAILED')

  await writeMarketingAudit({
    actorId: userId,
    entity: 'testimonial',
    action: 'collect_manually',
    entityPublicId: publicId,
  })
  return { testimonialPublicId: publicId }
}

export async function decideTestimonialImpl(
  input: TestimonialDecisionInput,
): Promise<{ ok: true; heavyEdit: boolean }> {
  const userId = await requireModerationRole()
  const testimonial = await resolveTestimonial(input.testimonialPublicId)

  const validation = validateModeration({
    decision: input.decision,
    consentConfirmed: testimonial.consentConfirmed,
    currentStatus: testimonial.status,
    quote: input.quote,
    rejectionReason: input.rejectionReason,
  })
  if (!validation.ok) {
    throw new Error(`MODERATION_INVALID:${validation.error}`)
  }

  if (input.decision === 'approve') {
    await db
      .update(testimonials)
      .set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(testimonials.id, testimonial.id))

    // Spec: on publish the student is thanked and shown where the quote
    // appears. Rejected students get a polite note and the row archives.
    await createNotifications([testimonial.studentId], {
      type: 'publish',
      title: 'Your testimonial is live',
      body: 'Thank you for sharing your experience — your quote now appears on the course page.',
      linkEntityType: 'course',
      linkEntityPublicId: null,
    })

    await writeMarketingAudit({
      actorId: userId,
      entity: 'testimonial',
      action: 'approve',
      entityPublicId: testimonial.publicId,
    })
    return { ok: true, heavyEdit: false }
  }

  if (input.decision === 'edit') {
    const heavy = isHeavyEdit(testimonial.quote, input.quote ?? testimonial.quote)
    await db
      .update(testimonials)
      .set({
        quote: input.quote,
        editedBy: userId,
        editedAt: new Date(),
        editNote: input.editNote ?? null,
        heavyEdit: heavy,
        updatedAt: new Date(),
      })
      .where(eq(testimonials.id, testimonial.id))

    await writeMarketingAudit({
      actorId: userId,
      entity: 'testimonial',
      action: 'edit',
      entityPublicId: testimonial.publicId,
      metadata: { heavyEdit: heavy, note: input.editNote ?? null },
    })
    return { ok: true, heavyEdit: heavy }
  }

  // Reject: retained as archived for reference, student notified politely.
  await db
    .update(testimonials)
    .set({
      status: 'archived',
      rejectionReason: input.rejectionReason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(testimonials.id, testimonial.id))

  await createNotifications([testimonial.studentId], {
    type: 'system',
    title: 'Thank you for sharing your experience',
    body: 'Your testimonial was reviewed. We are not able to publish it right now — thank you anyway!',
  })

  await writeMarketingAudit({
    actorId: userId,
    entity: 'testimonial',
    action: 'reject',
    entityPublicId: testimonial.publicId,
  })
  return { ok: true, heavyEdit: false }
}

export async function setTestimonialFeaturedImpl(
  input: TestimonialFeatureInput,
): Promise<{ ok: true }> {
  const userId = await requireModerationRole()
  const testimonial = await resolveTestimonial(input.testimonialPublicId)

  if (input.featured) {
    if (testimonial.status !== 'published') {
      throw new Error('MODERATION_INVALID:Only published testimonials can be featured')
    }
  } else if (testimonial.featured && testimonial.status === 'published') {
    // Unfeaturing a live, featured quote is revenue-adjacent; the UI wraps
    // this call in an S-7.1 confirmation, the server records the decision.
    await writeMarketingAudit({
      actorId: userId,
      entity: 'testimonial',
      action: 'unfeature_live',
      entityPublicId: testimonial.publicId,
    })
  }

  await db
    .update(testimonials)
    .set({
      featured: input.featured,
      featuredAt: input.featured ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(testimonials.id, testimonial.id))

  return { ok: true }
}

/**
 * Landing-page read (public marketing app consumes via the shared schema):
 * published, consented testimonials with active authors only — anonymized
 * students' quotes stay unlisted per the S-6.10 privacy state.
 */
export async function listPublishedTestimonialsImpl(input: {
  coursePublicId: string
  featuredOnly?: boolean
}): Promise<
  Array<{ publicId: string; quote: string; rating: number | null; studentName: string }>
> {
  const rows = await baseTestimonialSelect()
    .where(
      and(
        eq(testimonials.status, 'published'),
        eq(testimonials.consentConfirmed, true),
        eq(courses.publicId, input.coursePublicId),
        input.featuredOnly ? eq(testimonials.featured, true) : undefined,
      ),
    )
    .orderBy(desc(testimonials.featured), desc(testimonials.rating))
    .limit(20)

  return rows
    .filter((row) =>
      isAuthorActive({ deletedAt: row.studentDeletedAt, accountStatus: row.accountStatus }),
    )
    .map((row) => ({
      publicId: row.publicId,
      quote: row.quote,
      rating: row.rating,
      studentName: row.studentName ?? 'Abugida student',
    }))
}

/** Courses for filters and the manual collection dialog. */
export async function getTestimonialCourseOptionsImpl(): Promise<
  Array<{ publicId: string; title: string }>
> {
  await requireMarketingReadRole()
  const rows = await db
    .select({ publicId: courses.publicId, title: courses.title })
    .from(courses)
    .where(and(isNull(courses.deletedAt), inArray(courses.status, ['published', 'draft'])))
    .orderBy(courses.title)
    .limit(200)
  return rows
}

/** Five-star review count for the trigger summary card. */
export async function getFiveStarReviewStatsImpl(): Promise<{ fiveStarCount: number }> {
  await requireMarketingReadRole()
  const rows = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(courseReviews)
    .where(and(eq(courseReviews.rating, 5), isNull(courseReviews.deletedAt)))
  return { fiveStarCount: Number(rows.at(0)?.total ?? 0) }
}
