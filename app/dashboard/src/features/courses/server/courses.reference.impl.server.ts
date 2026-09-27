/**
 * Server-only implementation: reference data for course forms.
 */
import { and, asc, eq, isNull, sql } from '@abugida/database'
import { examTypes } from '@abugida/database/catalog'
import { paymentGateways } from '@abugida/database/finance'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import { requireUserId } from './courses.server-helpers.server'
import type { CourseFormReference } from '../courses.types'

const DEFAULT_EXAM_TYPES = [
  { name: 'TOEFL', slug: 'toefl', sortOrder: 10 },
  { name: 'IELTS', slug: 'ielts', sortOrder: 20 },
  { name: 'GRE', slug: 'gre', sortOrder: 30 },
  { name: 'Other', slug: 'other', sortOrder: 100 },
]

/**
 * The category select is backed by exam_types, which is reference data rather
 * than user-created course data. Keep the first-run experience usable while
 * preserving administrator-created categories and existing soft-deleted rows.
 */
async function ensureDefaultExamTypes(): Promise<void> {
  await db
    .insert(examTypes)
    .values(DEFAULT_EXAM_TYPES)
    .onConflictDoNothing({ target: examTypes.slug })
}

export async function loadCourseFormReference(): Promise<CourseFormReference> {
  await requireUserId()
  await ensureDefaultExamTypes()

  const [examTypeRows, instructorRows, gatewayRows] = await Promise.all([
    db
      .select({ id: examTypes.id, publicId: examTypes.publicId, name: examTypes.name })
      .from(examTypes)
      .where(and(eq(examTypes.isActive, true), isNull(examTypes.deletedAt)))
      .orderBy(asc(examTypes.sortOrder), asc(examTypes.name))
      .limit(100),
    db
      .select({
        id: users.id,
        name: sql<string>`COALESCE(${users.name}, ${users.email})`,
        email: sql<string>`COALESCE(${users.email}, '')`,
        image: users.image,
      })
      .from(users)
      .where(isNull(users.deletedAt))
      .orderBy(asc(users.name))
      .limit(200),
    db
      .select({
        publicId: paymentGateways.publicId,
        displayName: paymentGateways.displayName,
        providerName: paymentGateways.providerName,
        isEnabled: paymentGateways.isEnabled,
      })
      .from(paymentGateways)
      .where(isNull(paymentGateways.deletedAt))
      .orderBy(asc(paymentGateways.displayName)),
  ])

  return {
    examTypes: examTypeRows,
    instructors: instructorRows,
    gateways: gatewayRows,
  }
}
