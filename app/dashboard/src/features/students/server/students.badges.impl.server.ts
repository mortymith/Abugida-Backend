/**
 * Server-only implementation of S-4.7 Badges & Achievements: badge CRUD
 * (one trigger per badge, unique names), pause/archive, trigger preview,
 * on-demand evaluation, manual award with confirmation thresholds, and the
 * award history. Never import from client code.
 */
import { and, desc, eq, isNull, ne, sql } from '@abugida/database'
import {
  awardedBadges,
  badges,
  enrollments,
  lessonCompletions,
  quizAttempts,
} from '@abugida/database/learning'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  createNotifications,
  requireStudentReadRole,
  requireStudentWriteRole,
  resolveStudent,
} from './students.server-helpers.server'
import { toUtcDayKeys, computeStreaks } from '../students.streak'
import { matchesBadgeTrigger } from '../students.badge-triggers'
import type { BadgeTrigger } from '@abugida/database/learning'
import type {
  BadgeAwardInput,
  BadgeHistoryQuery,
  BadgeSaveInput,
  BadgeStatusChangeInput,
  BadgeTriggerPreviewInput,
} from '../schemas/students.schema'
import type { BadgeAwardRow, BadgeCard, TriggerPreviewResult } from '../students.types'

const MAX_EVALUATION_STUDENTS = 5_000

function triggerSpecFromInput(input: BadgeTriggerPreviewInput) {
  return { triggerKind: input.triggerKind, days: 'days' in input ? input.days : null }
}

export async function getBadgesImpl(): Promise<{ items: BadgeCard[] }> {
  await requireStudentReadRole()

  const rows = await db
    .select({
      publicId: badges.publicId,
      name: badges.name,
      description: badges.description,
      icon: badges.icon,
      triggerKind: sql<string>`${badges.triggerKind}::text`,
      triggerConfig: badges.triggerConfig,
      status: sql<string>`${badges.status}::text`,
      createdAt: badges.createdAt,
      awardCount: sql<number>`COUNT(${awardedBadges.id})::int`,
      lastAwardedAt: sql<string | null>`MAX(${awardedBadges.awardedAt})`,
    })
    .from(badges)
    .leftJoin(awardedBadges, eq(awardedBadges.badgeId, badges.id))
    .where(isNull(badges.deletedAt))
    .groupBy(badges.id)
    // Spec: badge grid sorted by total awards.
    .orderBy(desc(sql`COUNT(${awardedBadges.id})`), desc(badges.createdAt))
    .limit(100)

  return {
    items: rows.map((row) => ({
      publicId: row.publicId,
      name: row.name,
      description: row.description,
      icon: row.icon,
      triggerKind: row.triggerKind as BadgeTrigger,
      triggerDays: row.triggerConfig.days ?? null,
      status: row.status as 'active' | 'paused' | 'archived',
      awardCount: Number(row.awardCount),
      lastAwardedAt: row.lastAwardedAt ? new Date(row.lastAwardedAt).toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    })),
  }
}

export async function saveBadgeImpl(
  input: BadgeSaveInput,
): Promise<{ publicId: string; created: boolean }> {
  const staffId = await requireStudentWriteRole()

  const triggerSpec = triggerSpecFromInput(input.trigger)
  const triggerConfig = triggerSpec.days != null ? { days: triggerSpec.days } : {}

  const duplicateFilters = [
    sql`LOWER(${badges.name}) = ${input.name.toLowerCase()}`,
    isNull(badges.deletedAt),
  ]
  if (input.badgePublicId) duplicateFilters.push(ne(badges.publicId, input.badgePublicId))
  const duplicate = await db
    .select({ id: badges.id })
    .from(badges)
    .where(and(...duplicateFilters))
    .limit(1)
  if (duplicate.length > 0) {
    throw new Error('BADGE_NAME_EXISTS: a badge with this name already exists')
  }

  if (input.badgePublicId) {
    const rows = await db
      .select({ id: badges.id })
      .from(badges)
      .where(and(eq(badges.publicId, input.badgePublicId), isNull(badges.deletedAt)))
      .limit(1)
    const badge = rows.at(0)
    if (!badge) throw new Error('BADGE_NOT_FOUND')

    await db
      .update(badges)
      .set({
        name: input.name,
        description: input.description,
        icon: input.icon,
        triggerKind: triggerSpec.triggerKind,
        triggerConfig,
        notifyStudent: input.notifyStudent,
      })
      .where(eq(badges.id, badge.id))
    return { publicId: input.badgePublicId, created: false }
  }

  const inserted = await db
    .insert(badges)
    .values({
      name: input.name,
      description: input.description,
      icon: input.icon,
      triggerKind: triggerSpec.triggerKind,
      triggerConfig,
      notifyStudent: input.notifyStudent,
      createdBy: staffId,
    })
    .returning({ publicId: badges.publicId })
  const row = inserted.at(0)
  if (!row) throw new Error('CREATE_FAILED')
  return { publicId: row.publicId, created: true }
}

/** Pausing stops new awards without revoking existing ones (spec). */
export async function setBadgeStatusImpl(input: BadgeStatusChangeInput): Promise<{ ok: true }> {
  await requireStudentWriteRole()
  const rows = await db
    .select({ id: badges.id })
    .from(badges)
    .where(and(eq(badges.publicId, input.badgePublicId), isNull(badges.deletedAt)))
    .limit(1)
  const badge = rows.at(0)
  if (!badge) throw new Error('BADGE_NOT_FOUND')

  if (input.status === 'archived') {
    // Archiving keeps historical awards; the unique name frees up.
    await db
      .update(badges)
      .set({ deletedAt: new Date(), status: 'archived' })
      .where(eq(badges.id, badge.id))
  } else {
    await db.update(badges).set({ status: input.status }).where(eq(badges.id, badge.id))
  }
  return { ok: true }
}

/**
 * Exclusion: students already holding an award whose badge matches the
 * given trigger (kind + optional streak days) never re-match.
 */
function alreadyAwardedByTrigger(spec: { triggerKind: BadgeTrigger; days: number | null }) {
  return sql`NOT EXISTS (
    SELECT 1 FROM ${awardedBadges} ab
    JOIN ${badges} b ON b.id = ab.badge_id
    WHERE ab.student_id = ${users.id}
      AND b.trigger_kind = ${spec.triggerKind}
      AND (${spec.days} IS NULL OR b.trigger_config ->> 'days' = ${spec.days != null ? String(spec.days) : null})
  )`
}

export async function previewBadgeTriggerImpl(
  input: BadgeTriggerPreviewInput,
): Promise<TriggerPreviewResult> {
  await requireStudentWriteRole()

  const spec = triggerSpecFromInput(input)
  if (spec.triggerKind === 'manual') {
    return { matchedCount: 0, sample: [] }
  }

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      activityDays: sql<
        string[]
      >`COALESCE(ARRAY_AGG(DISTINCT DATE(${lessonCompletions.createdAt})::text) FILTER (WHERE ${lessonCompletions.id} IS NOT NULL), '{}')`,
      hasPerfectQuiz: sql<boolean | null>`BOOL_OR(${quizAttempts.quizScorePercentage} >= 100)`,
      completedCoursePublicIds: sql<
        string[]
      >`COALESCE(ARRAY_AGG(DISTINCT ${enrollments.courseId}::text) FILTER (WHERE ${enrollments.isCompleted} AND ${enrollments.deletedAt} IS NULL), '{}')`,
    })
    .from(users)
    .leftJoin(lessonCompletions, eq(lessonCompletions.studentId, users.id))
    .leftJoin(quizAttempts, eq(quizAttempts.studentId, users.id))
    .leftJoin(enrollments, eq(enrollments.studentId, users.id))
    .where(
      and(
        isNull(users.deletedAt),
        sql`NOT EXISTS (SELECT 1 FROM "member" WHERE "member"."user_id" = ${users.id})`,
        alreadyAwardedByTrigger(spec),
      ),
    )
    .groupBy(users.id)
    .limit(MAX_EVALUATION_STUDENTS)

  const todayUtc = new Date().toISOString().slice(0, 10)
  const matched = rows
    .map((row) => {
      const activityDays = toUtcDayKeys(row.activityDays)
      const streakDays = computeStreaks(activityDays, todayUtc).longest
      return {
        row,
        matched: matchesBadgeTrigger(spec, {
          activityDays,
          hasPerfectQuiz: row.hasPerfectQuiz ?? false,
          completedCoursePublicIds: row.completedCoursePublicIds,
          alreadyAwarded: false,
          streakDays,
        }),
      }
    })
    .filter((entry) => entry.matched)

  return {
    matchedCount: matched.length,
    sample: matched.slice(0, 10).map((entry) => ({
      id: entry.row.id,
      name: entry.row.name ?? 'Unnamed student',
      email: entry.row.email ?? '',
    })),
  }
}

/**
 * On-demand trigger evaluation ("next evaluation" from the spec). Awards
 * badges to every matching active student, notifying each recipient whose
 * badge has `notify_student` enabled. Manual badges are never auto-awarded.
 */
export async function evaluateBadgesImpl(): Promise<{
  evaluated: number
  awarded: number
}> {
  await requireStudentWriteRole()

  const activeBadges = (
    await db
      .select({
        id: badges.id,
        triggerKind: sql<string>`${badges.triggerKind}::text`,
        triggerConfig: badges.triggerConfig,
        notifyStudent: badges.notifyStudent,
      })
      .from(badges)
      .where(and(eq(badges.status, 'active'), isNull(badges.deletedAt)))
  ).filter((badge) => badge.triggerKind !== 'manual')
  if (activeBadges.length === 0) return { evaluated: 0, awarded: 0 }

  const todayUtc = new Date().toISOString().slice(0, 10)
  let awarded = 0

  for (const badge of activeBadges) {
    const spec: Parameters<typeof matchesBadgeTrigger>[0] = {
      triggerKind: badge.triggerKind as BadgeTrigger,
      days: badge.triggerConfig.days ?? null,
    }

    const candidates = await db
      .select({
        id: users.id,
        activityDays: sql<
          string[]
        >`COALESCE(ARRAY_AGG(DISTINCT DATE(${lessonCompletions.createdAt})::text) FILTER (WHERE ${lessonCompletions.id} IS NOT NULL), '{}')`,
        hasPerfectQuiz: sql<boolean | null>`BOOL_OR(${quizAttempts.quizScorePercentage} >= 100)`,
        completedCoursePublicIds: sql<
          string[]
        >`COALESCE(ARRAY_AGG(DISTINCT ${enrollments.courseId}::text) FILTER (WHERE ${enrollments.isCompleted} AND ${enrollments.deletedAt} IS NULL), '{}')`,
      })
      .from(users)
      .leftJoin(lessonCompletions, eq(lessonCompletions.studentId, users.id))
      .leftJoin(quizAttempts, eq(quizAttempts.studentId, users.id))
      .leftJoin(enrollments, eq(enrollments.studentId, users.id))
      .where(
        and(
          isNull(users.deletedAt),
          sql`NOT EXISTS (SELECT 1 FROM "member" WHERE "member"."user_id" = ${users.id})`,
          sql`NOT EXISTS (SELECT 1 FROM ${awardedBadges} ab WHERE ab.student_id = ${users.id} AND ab.badge_id = ${badge.id})`,
        ),
      )
      .groupBy(users.id)
      .limit(MAX_EVALUATION_STUDENTS)

    const matchedIds: string[] = []
    for (const candidate of candidates) {
      const activityDays = toUtcDayKeys(candidate.activityDays)
      const streakDays = computeStreaks(activityDays, todayUtc).longest
      if (
        matchesBadgeTrigger(spec, {
          activityDays,
          hasPerfectQuiz: candidate.hasPerfectQuiz ?? false,
          completedCoursePublicIds: candidate.completedCoursePublicIds,
          alreadyAwarded: false,
          streakDays,
        })
      ) {
        matchedIds.push(candidate.id)
      }
    }

    if (matchedIds.length > 0) {
      await db.transaction(async (tx) => {
        await tx
          .insert(awardedBadges)
          .values(
            matchedIds.map((studentId) => ({
              badgeId: badge.id,
              studentId,
              source: 'automatic' as const,
            })),
          )
          .onConflictDoNothing()
      })
      if (badge.notifyStudent) {
        const badgeRows = await db
          .select({ name: badges.name, icon: badges.icon })
          .from(badges)
          .where(eq(badges.id, badge.id))
          .limit(1)
        await createNotifications(matchedIds, {
          type: 'system',
          title: `Badge earned${badgeRows.at(0)?.icon ? ` ${badgeRows.at(0)?.icon}` : ''}`,
          body: badgeRows.at(0)?.name ?? 'New badge',
        })
      }
      awarded += matchedIds.length
    }
  }

  return { evaluated: activeBadges.length, awarded }
}

/** Manual award (S-4.7): one student or a filtered selection. */
export async function awardBadgeImpl(input: BadgeAwardInput): Promise<{ awarded: number }> {
  const staffId = await requireStudentWriteRole()

  const badgeRows = await db
    .select({
      id: badges.id,
      name: badges.name,
      icon: badges.icon,
      notifyStudent: badges.notifyStudent,
    })
    .from(badges)
    .where(and(eq(badges.publicId, input.badgePublicId), isNull(badges.deletedAt)))
    .limit(1)
  const badge = badgeRows.at(0)
  if (!badge) throw new Error('BADGE_NOT_FOUND')

  for (const studentId of input.studentIds) await resolveStudent(studentId)

  const inserted = await db
    .insert(awardedBadges)
    .values(
      input.studentIds.map((studentId) => ({
        badgeId: badge.id,
        studentId,
        source: 'manual' as const,
        awardedBy: staffId,
        note: input.note ?? null,
      })),
    )
    .onConflictDoNothing()
    .returning({ studentId: awardedBadges.studentId })
  const awardedIds = inserted.map((row) => row.studentId)

  if (badge.notifyStudent && awardedIds.length > 0) {
    await createNotifications(awardedIds, {
      type: 'system',
      title: `Badge earned${badge.icon ? ` ${badge.icon}` : ''}`,
      body: badge.name,
    })
  }
  return { awarded: awardedIds.length }
}

export async function getBadgeHistoryImpl(
  query: BadgeHistoryQuery,
): Promise<{ items: BadgeAwardRow[] }> {
  await requireStudentReadRole()

  const filters = [isNull(users.deletedAt)]
  if (query.badgePublicId) {
    const rows = await db
      .select({ id: badges.id })
      .from(badges)
      .where(and(eq(badges.publicId, query.badgePublicId), isNull(badges.deletedAt)))
      .limit(1)
    const badge = rows.at(0)
    if (!badge) throw new Error('BADGE_NOT_FOUND')
    filters.push(eq(awardedBadges.badgeId, badge.id))
  }

  const rows = await db
    .select({
      publicId: awardedBadges.publicId,
      badgeName: badges.name,
      badgeIcon: badges.icon,
      studentId: awardedBadges.studentId,
      studentName: users.name,
      source: sql<string>`${awardedBadges.source}::text`,
      note: awardedBadges.note,
      awardedAt: awardedBadges.awardedAt,
    })
    .from(awardedBadges)
    .innerJoin(badges, eq(badges.id, awardedBadges.badgeId))
    .innerJoin(users, eq(users.id, awardedBadges.studentId))
    .where(and(...filters))
    .orderBy(desc(awardedBadges.awardedAt))
    .limit(100)

  return {
    items: rows.map((row) => ({
      publicId: row.publicId,
      badgeName: row.badgeName,
      badgeIcon: row.badgeIcon,
      studentId: row.studentId,
      studentName: row.studentName ?? 'Unnamed student',
      source: row.source as 'automatic' | 'manual',
      note: row.note,
      awardedAt: row.awardedAt.toISOString(),
    })),
  }
}
