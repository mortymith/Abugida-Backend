/**
 * Server-only implementation of S-2.9 Live Session Scheduler.
 */
import { and, asc, eq, isNull, ne, sql } from '@abugida/database'
import { lessons, liveSessions } from '@abugida/database/catalog'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  createNotifications,
  requireAuthoringRole,
  resolveCourse,
} from './courses.server-helpers.server'
import type { LiveSessionSaveInput } from '../schemas/courses.learning.schema'
import type { LiveSessionDTO } from '../courses.types'

type SessionRow = typeof liveSessions.$inferSelect

function toDto(row: SessionRow, hostName: string | null): LiveSessionDTO {
  return {
    publicId: row.publicId,
    title: row.title,
    description: row.description,
    scheduledAt: row.scheduledAt.toISOString(),
    durationMinutes: row.durationMinutes,
    hostId: row.hostId,
    hostName,
    provider: row.provider,
    joinUrl: row.joinUrl,
    autoRecord: row.autoRecord,
    reminder24h: row.reminder24h,
    reminder1h: row.reminder1h,
    attendeeCount: row.attendeeCount,
    status: row.status,
    recordingLessonId: row.recordingLessonId,
  }
}

export async function getLiveSessionsImpl(coursePublicId: string): Promise<{
  upcoming: LiveSessionDTO[]
  history: LiveSessionDTO[]
}> {
  await requireAuthoringRole()
  const course = await resolveCourse(coursePublicId)

  const rows = await db
    .select({ session: liveSessions, hostName: users.name })
    .from(liveSessions)
    .leftJoin(users, eq(users.id, liveSessions.hostId))
    .where(and(eq(liveSessions.courseId, course.id), isNull(liveSessions.deletedAt)))
    .orderBy(asc(liveSessions.scheduledAt))
    .limit(200)

  const now = Date.now()
  const all = rows.map((row) => toDto(row.session, row.hostName))
  return {
    upcoming: all
      .filter(
        (session) =>
          session.status === 'scheduled' && new Date(session.scheduledAt).getTime() >= now,
      )
      .reverse(),
    history: all.filter(
      (session) => session.status !== 'scheduled' || new Date(session.scheduledAt).getTime() < now,
    ),
  }
}

export async function saveLiveSessionImpl(input: LiveSessionSaveInput): Promise<LiveSessionDTO> {
  await requireAuthoringRole()
  const course = await resolveCourse(input.coursePublicId)

  if (input.joinUrl == null && input.provider === 'custom') {
    throw new Error('JOIN_URL_REQUIRED: custom providers need a join URL')
  }
  const scheduledAt = new Date(input.scheduledAt)
  if (Number.isNaN(scheduledAt.getTime())) throw new Error('INVALID_DATE')

  // Spec: warn on host overlap — enforced server-side, not just UI hint.
  const overlapEnd = new Date(scheduledAt.getTime() + (input.durationMinutes ?? 60) * 60_000)
  const overlapping = await db
    .select({ publicId: liveSessions.publicId, title: liveSessions.title })
    .from(liveSessions)
    .where(
      and(
        eq(liveSessions.hostId, input.hostId),
        eq(liveSessions.status, 'scheduled'),
        isNull(liveSessions.deletedAt),
        input.sessionPublicId ? ne(liveSessions.publicId, input.sessionPublicId) : undefined,
        sql`${liveSessions.scheduledAt} < ${overlapEnd.toISOString()}::timestamptz`,
        sql`(${liveSessions.scheduledAt} + COALESCE(${liveSessions.durationMinutes}, 60) * INTERVAL '1 minute') > ${scheduledAt.toISOString()}::timestamptz`,
      ),
    )
    .limit(1)
  if (overlapping.length > 0) {
    throw new Error(
      `HOST_CONFLICT: ${input.hostId} already has "${overlapping[0].title}" scheduled then`,
    )
  }

  let resultPublicId: string
  if (input.sessionPublicId) {
    await db
      .update(liveSessions)
      .set({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        scheduledAt,
        durationMinutes: input.durationMinutes,
        hostId: input.hostId,
        provider: input.provider,
        joinUrl: input.joinUrl,
        autoRecord: input.autoRecord,
        reminder24h: input.reminder24h,
        reminder1h: input.reminder1h,
      })
      .where(eq(liveSessions.publicId, input.sessionPublicId))
    resultPublicId = input.sessionPublicId
  } else {
    const inserted = await db
      .insert(liveSessions)
      .values({
        courseId: course.id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        scheduledAt,
        durationMinutes: input.durationMinutes,
        hostId: input.hostId,
        provider: input.provider,
        joinUrl: input.joinUrl,
        autoRecord: input.autoRecord,
        reminder24h: input.reminder24h,
        reminder1h: input.reminder1h,
        attendeeCount: 0,
        status: 'scheduled',
      })
      .returning({ publicId: liveSessions.publicId })
    resultPublicId = inserted.at(0)!.publicId
  }

  const rows = await db
    .select()
    .from(liveSessions)
    .where(eq(liveSessions.publicId, resultPublicId))
    .limit(1)
  const session = rows.at(0)
  if (!session) throw new Error('SESSION_NOT_FOUND')
  return toDto(session, null)
}

export async function cancelLiveSessionImpl(input: {
  sessionPublicId: string
  notifyAttendees: boolean
}): Promise<{ ok: true }> {
  await requireAuthoringRole()
  const rows = await db
    .select()
    .from(liveSessions)
    .where(and(eq(liveSessions.publicId, input.sessionPublicId), isNull(liveSessions.deletedAt)))
    .limit(1)
  const session = rows.at(0)
  if (!session) throw new Error('SESSION_NOT_FOUND')

  await db.update(liveSessions).set({ status: 'cancelled' }).where(eq(liveSessions.id, session.id))

  if (input.notifyAttendees && session.attendeeCount > 0) {
    await createNotifications([], {
      type: 'system',
      title: `Session cancelled: ${session.title}`,
    })
  }
  return { ok: true }
}

export async function attachSessionRecordingImpl(input: {
  sessionPublicId: string
  lessonPublicId: string
}): Promise<{ ok: true }> {
  await requireAuthoringRole()
  const rows = await db
    .select({ id: liveSessions.id })
    .from(liveSessions)
    .where(and(eq(liveSessions.publicId, input.sessionPublicId), isNull(liveSessions.deletedAt)))
    .limit(1)
  const session = rows.at(0)
  if (!session) throw new Error('SESSION_NOT_FOUND')

  const lessonRows = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.publicId, input.lessonPublicId), isNull(lessons.deletedAt)))
    .limit(1)
  const lessonId = lessonRows.at(0)?.id
  if (!lessonId) throw new Error('LESSON_NOT_FOUND')

  await db
    .update(liveSessions)
    .set({ recordingLessonId: lessonId, status: 'completed' })
    .where(eq(liveSessions.id, session.id))
  return { ok: true }
}
