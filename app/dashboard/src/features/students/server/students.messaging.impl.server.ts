/**
 * Server-only implementation of S-4.5 Messaging Center: threaded staff ↔
 * student conversations, broadcast fan-out to cohorts, optimistic-friendly
 * send + mark-read. Never import from client code.
 */
import { and, asc, desc, eq, ilike, isNull, or, sql } from '@abugida/database'
import { courses, lessons } from '@abugida/database/catalog'
import { messages, messageThreads } from '@abugida/database/ops'
import { cohortMembers } from '@abugida/database/learning'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  requireMessagingRole,
  requireStudentReadRole,
  resolveStudent,
  searchPattern,
} from './students.server-helpers.server'
import type {
  BroadcastInput,
  BroadcastPreviewInput,
  SendMessageInput,
  ThreadMessagesQuery,
  ThreadsQuery,
  ThreadPublicIdInput,
} from '../schemas/students.schema'
import type { MessageItem, MessageThreadItem, MessageThreadPage } from '../students.types'

const THREADS_PAGE_SIZE = 30
const MESSAGES_PAGE_SIZE = 50

export async function getThreadsImpl(query: ThreadsQuery): Promise<MessageThreadPage> {
  await requireMessagingRole()

  const filters = [isNull(users.deletedAt)]
  const pattern = searchPattern(query.q)
  if (pattern) {
    filters.push(or(ilike(users.name, pattern), ilike(users.email, pattern)) ?? isNull(users.id))
  }
  if (query.filter === 'unread') {
    filters.push(sql`${messageThreads.unreadStaffCount} > 0`)
  }
  if (query.filter === 'broadcast') {
    filters.push(eq(messageThreads.kind, 'broadcast'))
  }

  const page = query.page ?? 1
  const rows = await db
    .select({
      publicId: messageThreads.publicId,
      studentId: messageThreads.studentId,
      studentName: users.name,
      studentEmail: users.email,
      kind: sql<string>`${messageThreads.kind}::text`,
      subject: messageThreads.subject,
      lastMessageAt: messageThreads.lastMessageAt,
      lastMessagePreview: messageThreads.lastMessagePreview,
      unreadStaffCount: messageThreads.unreadStaffCount,
    })
    .from(messageThreads)
    .innerJoin(users, eq(users.id, messageThreads.studentId))
    .where(and(...filters))
    .orderBy(desc(messageThreads.lastMessageAt))
    .limit(THREADS_PAGE_SIZE + 1)
    .offset((page - 1) * THREADS_PAGE_SIZE)

  const totalRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(messageThreads)
    .innerJoin(users, eq(users.id, messageThreads.studentId))
    .where(and(...filters))

  const items: MessageThreadItem[] = rows.slice(0, THREADS_PAGE_SIZE).map((row) => ({
    publicId: row.publicId,
    studentId: row.studentId,
    studentName: row.studentName ?? 'Unnamed student',
    studentEmail: row.studentEmail ?? '',
    kind: row.kind as 'direct' | 'broadcast',
    subject: row.subject,
    lastMessageAt: row.lastMessageAt.toISOString(),
    lastMessagePreview: row.lastMessagePreview,
    unreadStaffCount: row.unreadStaffCount,
  }))

  return {
    items,
    page,
    pageSize: THREADS_PAGE_SIZE,
    totalRows: Number(totalRows.at(0)?.count ?? 0),
    hasNextPage: rows.length > THREADS_PAGE_SIZE,
  }
}

export async function getThreadMessagesImpl(
  input: ThreadMessagesQuery,
): Promise<{ items: MessageItem[]; hasNextPage: boolean; page: number }> {
  await requireMessagingRole()

  const threadRows = await db
    .select({ id: messageThreads.id })
    .from(messageThreads)
    .where(eq(messageThreads.publicId, input.threadPublicId))
    .limit(1)
  const thread = threadRows.at(0)
  if (!thread) throw new Error('THREAD_NOT_FOUND')

  const page = input.page ?? 1
  const rows = await db
    .select({
      publicId: messages.publicId,
      senderId: messages.senderId,
      senderName: users.name,
      isStaff: sql<boolean>`EXISTS (SELECT 1 FROM "member" WHERE "member"."user_id" = ${messages.senderId})`,
      body: messages.body,
      attachments: messages.attachments,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.senderId))
    .where(eq(messages.threadId, thread.id))
    .orderBy(desc(messages.createdAt))
    .limit(MESSAGES_PAGE_SIZE + 1)
    .offset((page - 1) * MESSAGES_PAGE_SIZE)

  // Newest-first for pagination; the UI reverses for chronological display.
  return {
    items: rows.slice(0, MESSAGES_PAGE_SIZE).map((row) => ({
      publicId: row.publicId,
      senderId: row.senderId,
      senderName: row.senderName ?? 'Unknown sender',
      isStaff: row.isStaff,
      body: row.body,
      attachments: row.attachments,
      createdAt: row.createdAt.toISOString(),
    })),
    hasNextPage: rows.length > MESSAGES_PAGE_SIZE,
    page,
  }
}

/** Send a reply in an existing thread or open a new direct thread. */
export async function sendMessageImpl(
  input: SendMessageInput,
): Promise<{ threadPublicId: string; messagePublicId: string }> {
  const staffId = await requireMessagingRole()
  if (input.threadPublicId == null && input.studentId == null) {
    throw new Error('VALIDATION_FAILED: a thread or student is required')
  }

  return db.transaction(async (tx) => {
    let threadId: number
    let threadPublicId: string

    if (input.threadPublicId) {
      const rows = await tx
        .select({ id: messageThreads.id, publicId: messageThreads.publicId })
        .from(messageThreads)
        .where(eq(messageThreads.publicId, input.threadPublicId))
        .limit(1)
      const thread = rows.at(0)
      if (!thread) throw new Error('THREAD_NOT_FOUND')
      threadId = thread.id
      threadPublicId = thread.publicId
    } else {
      const studentId = input.studentId as string
      await resolveStudent(studentId)
      const inserted = await tx
        .insert(messageThreads)
        .values({
          studentId,
          staffId,
          kind: 'direct',
          subject: input.subject ?? null,
        })
        .returning({ id: messageThreads.id, publicId: messageThreads.publicId })
      const thread = inserted.at(0)
      if (!thread) throw new Error('SEND_FAILED')
      threadId = thread.id
      threadPublicId = thread.publicId
    }

    const insertedMessage = await tx
      .insert(messages)
      .values({
        threadId,
        senderId: staffId,
        body: input.body,
        attachments: input.attachments,
      })
      .returning({ publicId: messages.publicId })
    const message = insertedMessage.at(0)
    if (!message) throw new Error('SEND_FAILED')

    await tx
      .update(messageThreads)
      .set({ lastMessageAt: new Date(), lastMessagePreview: input.body.slice(0, 200) })
      .where(eq(messageThreads.id, threadId))

    return { threadPublicId, messagePublicId: message.publicId }
  })
}

/** Broadcast preview: recipient count for the S-4.5 confirmation copy. */
export async function previewBroadcastImpl(
  input: BroadcastPreviewInput,
): Promise<{ recipientCount: number; cohortName: string }> {
  await requireMessagingRole()

  const { cohorts } = await import('@abugida/database/learning')
  const cohortRows = await db
    .select({ id: cohorts.id, name: cohorts.name })
    .from(cohorts)
    .where(and(eq(cohorts.publicId, input.cohortPublicId), isNull(cohorts.deletedAt)))
    .limit(1)
  const cohort = cohortRows.at(0)
  if (!cohort) throw new Error('COHORT_NOT_FOUND')

  const rows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(cohortMembers)
    .where(eq(cohortMembers.cohortId, cohort.id))
  return { recipientCount: Number(rows.at(0)?.count ?? 0), cohortName: cohort.name }
}

/**
 * Broadcast to a cohort (S-4.5): creates one thread per recipient sharing a
 * broadcast_group_id, in a single transaction. Fails atomically.
 */
export async function broadcastImpl(
  input: BroadcastInput,
): Promise<{ created: number; broadcastGroupId: string }> {
  const staffId = await requireMessagingRole()

  const { cohorts } = await import('@abugida/database/learning')
  const cohortRows = await db
    .select({ id: cohorts.id, name: cohorts.name })
    .from(cohorts)
    .where(and(eq(cohorts.publicId, input.cohortPublicId), isNull(cohorts.deletedAt)))
    .limit(1)
  const cohort = cohortRows.at(0)
  if (!cohort) throw new Error('COHORT_NOT_FOUND')

  const memberRows = await db
    .select({ studentId: cohortMembers.studentId })
    .from(cohortMembers)
    .where(eq(cohortMembers.cohortId, cohort.id))
  const recipientIds = Array.from(new Set(memberRows.map((row) => row.studentId)))

  if (recipientIds.length === 0) throw new Error('EMPTY_COHORT: this cohort has no students')
  if (recipientIds.length !== input.confirmedCount) {
    throw new Error(
      `RECIPIENT_COUNT_CHANGED: recipient count is now ${recipientIds.length}; review and resend`,
    )
  }

  const broadcastGroupId = crypto.randomUUID()
  const preview = input.body.slice(0, 200)

  await db.transaction(async (tx) => {
    await tx.insert(messageThreads).values(
      recipientIds.map((studentId) => ({
        studentId,
        staffId,
        kind: 'broadcast' as const,
        subject: input.subject,
        broadcastGroupId,
        lastMessageAt: new Date(),
        lastMessagePreview: preview,
      })),
    )
    const threadRows = await tx
      .select({ id: messageThreads.id })
      .from(messageThreads)
      .where(eq(messageThreads.broadcastGroupId, broadcastGroupId))

    await tx.insert(messages).values(
      threadRows.map((thread) => ({
        threadId: thread.id,
        senderId: staffId,
        body: input.body,
        attachments: input.attachments,
      })),
    )
  })

  return { created: recipientIds.length, broadcastGroupId }
}

/** Staff opened the thread → clear the staff-side unread counter. */
export async function markThreadReadImpl(input: ThreadPublicIdInput): Promise<{ ok: true }> {
  await requireMessagingRole()
  await db
    .update(messageThreads)
    .set({ unreadStaffCount: 0 })
    .where(eq(messageThreads.publicId, input.threadPublicId))
  return { ok: true }
}

/** Threads for one student (S-4.2 Messages tab). */
export async function getStudentThreadsImpl(studentId: string): Promise<MessageThreadItem[]> {
  await requireStudentReadRole()
  await resolveStudent(studentId)

  const rows = await db
    .select({
      publicId: messageThreads.publicId,
      studentId: messageThreads.studentId,
      studentName: users.name,
      studentEmail: users.email,
      kind: sql<string>`${messageThreads.kind}::text`,
      subject: messageThreads.subject,
      lastMessageAt: messageThreads.lastMessageAt,
      lastMessagePreview: messageThreads.lastMessagePreview,
      unreadStaffCount: messageThreads.unreadStaffCount,
    })
    .from(messageThreads)
    .innerJoin(users, eq(users.id, messageThreads.studentId))
    .where(eq(messageThreads.studentId, studentId))
    .orderBy(desc(messageThreads.lastMessageAt))
    .limit(20)

  return rows.map((row) => ({
    publicId: row.publicId,
    studentId: row.studentId,
    studentName: row.studentName ?? 'Unnamed student',
    studentEmail: row.studentEmail ?? '',
    kind: row.kind as 'direct' | 'broadcast',
    subject: row.subject,
    lastMessageAt: row.lastMessageAt.toISOString(),
    lastMessagePreview: row.lastMessagePreview,
    unreadStaffCount: row.unreadStaffCount,
  }))
}

/** Lightweight lesson/course search for message attachment pickers. */
export async function searchAttachableEntitiesImpl(
  q: string,
): Promise<Array<{ kind: 'lesson' | 'course'; entityPublicId: string; label: string }>> {
  await requireMessagingRole()
  const pattern = searchPattern(q)
  if (!pattern) return []

  const [courseRows, lessonRows] = await Promise.all([
    db
      .select({ entityPublicId: courses.publicId, label: courses.title })
      .from(courses)
      .where(and(isNull(courses.deletedAt), ilike(courses.title, pattern)))
      .orderBy(asc(courses.title))
      .limit(5),
    db
      .select({ entityPublicId: lessons.publicId, label: lessons.title })
      .from(lessons)
      .where(and(isNull(lessons.deletedAt), ilike(lessons.title, pattern)))
      .orderBy(asc(lessons.title))
      .limit(8),
  ])

  return [
    ...courseRows.map((row) => ({ kind: 'course' as const, ...row })),
    ...lessonRows.map((row) => ({ kind: 'lesson' as const, ...row })),
  ]
}
