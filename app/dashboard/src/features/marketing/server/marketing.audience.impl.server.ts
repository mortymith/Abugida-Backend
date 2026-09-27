/**
 * Server-only audience segment resolution (spec 10 S-8.1). The stored
 * segment description is resolved against the authoritative student model —
 * never a parallel marketing database. Every resolution ANDs the
 * consent-aware suppression required by the spec:
 *
 *   - `user_consents` latest `marketing` row must be granted
 *   - unsubscribed/bounced recipients are excluded automatically
 *   - staff accounts are never part of a marketing audience
 *   - active accounts only, no deleted/deactivated users
 *
 * All filtering happens database-side; the browser never receives the full
 * population — only counts and a small preview sample.
 */
import { and, eq, inArray, isNotNull, isNull, notInArray, sql } from '@abugida/database'
import { userConsents, users } from '@abugida/database/auth'
import { cohorts, cohortMembers, enrollments, studentTags } from '@abugida/database/learning'
import { courses } from '@abugida/database/catalog'
import { campaignEvents } from '@abugida/database/marketing'
import { db } from '#/config/db.config'
import type { CampaignAudience } from '@abugida/database/marketing'
import type { AudiencePreview } from '../marketing.types'
import { staffUserIds } from '#/features/students/server/students.server-helpers.server'

const PREVIEW_LIMIT = 8

/**
 * Latest marketing-consent row per user. Consents are versioned — the most
 * recent record wins, so a withdrawn consent suppresses the user even when
 * an older version was granted.
 */
function latestMarketingConsent() {
  return db
    .select({
      userId: userConsents.userId,
      isGranted: userConsents.isGranted,
      rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${userConsents.userId} ORDER BY ${userConsents.consentedAt} DESC)`.as(
        'consent_rank',
      ),
    })
    .from(userConsents)
    .where(eq(userConsents.consentType, 'marketing'))
    .as('latest_marketing_consent')
}

/** Cohort membership user ids (S-4.4 cohorts). */
function cohortUserIds(publicIds: string[]) {
  return db
    .select({ id: cohortMembers.studentId })
    .from(cohortMembers)
    .innerJoin(cohorts, eq(cohorts.id, cohortMembers.cohortId))
    .where(and(isNull(cohorts.deletedAt), inArray(cohorts.publicId, publicIds)))
    .as('cohort_users')
}

/** Enrollment-based user ids across the scoped courses. */
function courseUserIds(publicIds: string[]) {
  return db
    .select({ id: enrollments.studentId })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(and(isNull(enrollments.deletedAt), inArray(courses.publicId, publicIds)))
    .as('course_users')
}

/** Tag-based user ids (S-4.8 student tags). */
function taggedUserIds(tags: string[]) {
  return db
    .select({ id: studentTags.studentId })
    .from(studentTags)
    .where(inArray(studentTags.tag, tags))
    .as('tagged_users')
}

/** Users who completed at least one course. */
function completerUserIds() {
  return db
    .select({ id: enrollments.studentId })
    .from(enrollments)
    .where(and(eq(enrollments.isCompleted, true), isNull(enrollments.deletedAt)))
    .as('completer_users')
}

/** Emails that bounced or unsubscribed in any past campaign. */
function suppressedEmailSelect() {
  return db
    .select({ email: campaignEvents.email })
    .from(campaignEvents)
    .where(inArray(campaignEvents.eventType, ['bounced', 'unsubscribed']))
}

export interface ResolvedRecipient {
  userId: string
  name: string
  email: string
}

/**
 * Resolve a segment into recipients. Public entry point used by audience
 * preview, test sends, and the send pipeline itself.
 */
export async function resolveAudienceRecipients(
  audience: CampaignAudience,
  limit?: number,
): Promise<ResolvedRecipient[]> {
  const consent = latestMarketingConsent()
  const staffIds = await staffUserIds()

  const filters = [
    isNull(users.deletedAt),
    eq(users.accountStatus, 'active'),
    // PII purge nulls emails post-deletion — those users are undeliverable.
    isNotNull(users.email),
    eq(consent.rank, 1),
    eq(consent.isGranted, true),
    notInArray(users.email, suppressedEmailSelect()),
  ]

  if (staffIds.length > 0) filters.push(notInArray(users.id, staffIds))
  if (audience.cohortPublicIds.length > 0) {
    filters.push(inArray(users.id, cohortUserIds(audience.cohortPublicIds)))
  }
  if (audience.coursePublicIds.length > 0) {
    filters.push(inArray(users.id, courseUserIds(audience.coursePublicIds)))
  }
  if (audience.tags.length > 0) {
    filters.push(inArray(users.id, taggedUserIds(audience.tags)))
  }

  switch (audience.activity) {
    case 'active_30d':
      filters.push(sql`${users.lastLoginAt} >= NOW() - INTERVAL '30 days'`)
      break
    case 'inactive_30d':
      filters.push(
        sql`(${users.lastLoginAt} IS NULL OR ${users.lastLoginAt} < NOW() - INTERVAL '30 days')`,
      )
      break
    case 'completed':
      filters.push(inArray(users.id, completerUserIds()))
      break
    default:
      break
  }

  let statement = db
    .select({
      userId: users.id,
      name: sql<string>`COALESCE(${users.name}, 'Student')`,
      email: sql<string>`${users.email}`,
    })
    .from(users)
    .innerJoin(consent, and(eq(consent.userId, users.id), eq(consent.isGranted, true)))
    .where(and(...filters))
    .orderBy(users.id)
    .$dynamic()

  if (limit != null) statement = statement.limit(limit)

  return statement
}

/**
 * Audience preview for the composer (S-8.1): the final deliverable count
 * after consent/suppression filtering, the matched population before it so
 * the difference is visible, and a small sample for a sanity check.
 */
export async function previewAudienceImpl(audience: CampaignAudience): Promise<AudiencePreview> {
  const recipients = await resolveAudienceRecipients(audience)
  const sample = recipients.slice(0, PREVIEW_LIMIT).map((recipient) => ({
    id: recipient.userId,
    name: recipient.name,
    email: recipient.email,
  }))

  const consent = latestMarketingConsent()
  const staffIds = await staffUserIds()
  const matchedFilters = [
    isNull(users.deletedAt),
    eq(users.accountStatus, 'active'),
    eq(consent.rank, 1),
    eq(consent.isGranted, true),
  ]
  if (staffIds.length > 0) matchedFilters.push(notInArray(users.id, staffIds))

  const matchedRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(users)
    .innerJoin(consent, and(eq(consent.userId, users.id), eq(consent.isGranted, true)))
    .where(and(...matchedFilters))

  return {
    count: recipients.length,
    matched: Number(matchedRows.at(0)?.count ?? 0),
    sample,
  }
}
