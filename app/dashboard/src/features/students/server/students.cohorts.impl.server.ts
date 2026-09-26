/**
 * Server-only implementation of S-4.4 Cohort Management: cohort cards with
 * member counts and average progress, CRUD, and membership management.
 * Never import from client code.
 */
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from '@abugida/database'
import { cohortMembers, cohorts, enrollments } from '@abugida/database/learning'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  requireStudentReadRole,
  requireStudentWriteRole,
  resolveStudent,
  searchPattern,
} from './students.server-helpers.server'
import type {
  CohortCreateInput,
  CohortMembersUpdateInput,
  CohortPublicIdInput,
  CohortsQuery,
  CohortUpdateInput,
} from '../schemas/students.schema'
import type { CohortCard, CohortMemberRow } from '../students.types'

async function resolveCohort(cohortPublicId: string) {
  const rows = await db
    .select()
    .from(cohorts)
    .where(and(eq(cohorts.publicId, cohortPublicId), isNull(cohorts.deletedAt)))
    .limit(1)
  const cohort = rows.at(0)
  if (!cohort) throw new Error('COHORT_NOT_FOUND')
  return cohort
}

export async function getCohortsImpl(query: CohortsQuery): Promise<{ items: CohortCard[] }> {
  await requireStudentReadRole()

  const pattern = searchPattern(query.q)
  const rows = await db
    .select({
      publicId: cohorts.publicId,
      name: cohorts.name,
      description: cohorts.description,
      startedAt: cohorts.startedAt,
      createdAt: cohorts.createdAt,
      memberCount: sql<number>`COUNT(${cohortMembers.id})::int`,
      avgProgress: sql<
        number | null
      >`AVG(${enrollments.progressPercentage}) FILTER (WHERE ${enrollments.deletedAt} IS NULL)`,
    })
    .from(cohorts)
    .leftJoin(cohortMembers, eq(cohortMembers.cohortId, cohorts.id))
    .leftJoin(
      enrollments,
      and(eq(enrollments.studentId, cohortMembers.studentId), isNull(enrollments.deletedAt)),
    )
    .where(
      pattern
        ? and(
            isNull(cohorts.deletedAt),
            or(ilike(cohorts.name, pattern), ilike(cohorts.description, pattern)),
          )
        : isNull(cohorts.deletedAt),
    )
    .groupBy(cohorts.id)
    .orderBy(desc(cohorts.createdAt))
    .limit(200)

  return {
    items: rows.map((row) => ({
      publicId: row.publicId,
      name: row.name,
      description: row.description,
      startedAt: row.startedAt ?? null,
      memberCount: Number(row.memberCount),
      avgProgress: row.avgProgress == null ? null : Math.round(Number(row.avgProgress)),
      createdAt: row.createdAt.toISOString(),
    })),
  }
}

export async function getCohortMembersImpl(input: CohortPublicIdInput): Promise<CohortMemberRow[]> {
  await requireStudentReadRole()
  const cohort = await resolveCohort(input.cohortPublicId)

  const memberAgg = db
    .select({
      studentId: enrollments.studentId,
      avgProgress: sql<number | null>`AVG(${enrollments.progressPercentage})`.as(
        'member_avg_progress',
      ),
    })
    .from(enrollments)
    .where(isNull(enrollments.deletedAt))
    .groupBy(enrollments.studentId)
    .as('member_agg')

  const rows = await db
    .select({
      studentId: cohortMembers.studentId,
      name: users.name,
      email: users.email,
      avgProgress: memberAgg.avgProgress,
      addedAt: cohortMembers.createdAt,
    })
    .from(cohortMembers)
    .innerJoin(users, eq(users.id, cohortMembers.studentId))
    .leftJoin(memberAgg, eq(memberAgg.studentId, cohortMembers.studentId))
    .where(and(eq(cohortMembers.cohortId, cohort.id), isNull(users.deletedAt)))
    .orderBy(asc(users.name))
    .limit(500)

  return rows.map((row) => ({
    studentId: row.studentId,
    name: row.name ?? 'Unnamed student',
    email: row.email ?? '',
    avgProgress: row.avgProgress == null ? null : Math.round(Number(row.avgProgress)),
    addedAt: row.addedAt.toISOString(),
  }))
}

export async function createCohortImpl(input: CohortCreateInput): Promise<{ publicId: string }> {
  const staffId = await requireStudentWriteRole()

  const publicId = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(cohorts)
      .values({
        name: input.name,
        description: input.description,
        startedAt: input.startedAt,
        createdBy: staffId,
      })
      .returning({ publicId: cohorts.publicId, id: cohorts.id })
    const cohort = inserted.at(0)
    if (!cohort) throw new Error('CREATE_FAILED')

    if (input.studentIds.length > 0) {
      await tx.insert(cohortMembers).values(
        input.studentIds.map((studentId) => ({
          cohortId: cohort.id,
          studentId,
          addedBy: staffId,
        })),
      )
    }
    return cohort.publicId
  })

  return { publicId }
}

export async function updateCohortImpl(input: CohortUpdateInput & CohortPublicIdInput) {
  await requireStudentWriteRole()
  const cohort = await resolveCohort(input.cohortPublicId)
  await db
    .update(cohorts)
    .set({
      name: input.name,
      description: input.description,
      startedAt: input.startedAt,
    })
    .where(eq(cohorts.id, cohort.id))
  return { ok: true }
}

export async function deleteCohortImpl(input: CohortPublicIdInput): Promise<{ ok: true }> {
  await requireStudentWriteRole()
  const cohort = await resolveCohort(input.cohortPublicId)
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.delete(cohortMembers).where(eq(cohortMembers.cohortId, cohort.id))
    await tx.update(cohorts).set({ deletedAt: now }).where(eq(cohorts.id, cohort.id))
  })
  return { ok: true }
}

/** Add/remove students in one transaction (S-4.4 "Manage"). */
export async function updateCohortMembersImpl(
  input: CohortMembersUpdateInput,
): Promise<{ added: number; removed: number }> {
  const staffId = await requireStudentWriteRole()
  const cohort = await resolveCohort(input.cohortPublicId)

  let added = 0
  let removed = 0
  await db.transaction(async (tx) => {
    if (input.addStudentIds.length > 0) {
      const inserted = await tx
        .insert(cohortMembers)
        .values(
          input.addStudentIds.map((studentId) => ({
            cohortId: cohort.id,
            studentId,
            addedBy: staffId,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: cohortMembers.id })
      added = inserted.length
    }
    if (input.removeStudentIds.length > 0) {
      const deleted = await tx
        .delete(cohortMembers)
        .where(
          and(
            eq(cohortMembers.cohortId, cohort.id),
            inArray(cohortMembers.studentId, input.removeStudentIds),
          ),
        )
        .returning({ id: cohortMembers.id })
      removed = deleted.length
    }
  })

  return { added, removed }
}

/** Student picker candidates for cohort membership (lightweight list). */
export async function listCohortCandidateStudentsImpl(
  q: string | undefined,
): Promise<Array<{ id: string; name: string; email: string }>> {
  await requireStudentReadRole()
  const pattern = searchPattern(q)
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(
      pattern
        ? and(
            isNull(users.deletedAt),
            sql`NOT EXISTS (SELECT 1 FROM "member" WHERE "member"."user_id" = ${users.id})`,
            or(ilike(users.name, pattern), ilike(users.email, pattern)),
          )
        : and(
            isNull(users.deletedAt),
            sql`NOT EXISTS (SELECT 1 FROM "member" WHERE "member"."user_id" = ${users.id})`,
          ),
    )
    .orderBy(asc(users.name))
    .limit(50)
  return rows.map((row) => ({
    id: row.id,
    name: row.name ?? 'Unnamed student',
    email: row.email ?? '',
  }))
}

/** Cohort ids a student belongs to (profile context + rule triggers). */
export async function cohortIdsForStudentImpl(studentId: string): Promise<string[]> {
  await requireStudentReadRole()
  await resolveStudent(studentId)
  const rows = await db
    .select({ publicId: cohorts.publicId })
    .from(cohortMembers)
    .innerJoin(cohorts, eq(cohorts.id, cohortMembers.cohortId))
    .where(and(eq(cohortMembers.studentId, studentId), isNull(cohorts.deletedAt)))
  return rows.map((row) => row.publicId)
}
