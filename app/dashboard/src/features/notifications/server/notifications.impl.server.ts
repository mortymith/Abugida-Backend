/**
 * Server-only implementation of S-1.4 Notifications Center.
 * Never import from client code — pulls in the database client, Better Auth
 * server instance, and drizzle operators.
 */
import { and, desc, eq, inArray, isNull, sql } from '@abugida/database'
import { notifications } from '@abugida/database/ops'
import { db } from '#/config/db.config'
import { auth } from '#/config/auth.server'
import { getRequest } from '@tanstack/react-start/server'
import { resolveEntityLink } from '#/lib/entity-links'
import type { LinkableEntityType } from '#/lib/entity-links'
import type { NotificationsTab, NotificationItem, NotificationsPage } from '../notifications.types'

const PAGE_SIZE = 20

/** System tab covers workflow/system events; mentions are direct @mentions. */
function tabFilter(tab: NotificationsTab) {
  switch (tab) {
    case 'mentions':
      return eq(notifications.type, 'mention')
    case 'system':
      return inArray(notifications.type, ['system', 'publish', 'team_invite', 'review'])
    default:
      return undefined
  }
}

function toItem(row: typeof notifications.$inferSelect): NotificationItem {
  const link =
    row.linkEntityType && row.linkEntityPublicId
      ? resolveEntityLink(row.linkEntityType as LinkableEntityType, row.linkEntityPublicId)
      : null
  return {
    publicId: row.publicId,
    type: row.type,
    title: row.title,
    body: row.body,
    linkEntityType: row.linkEntityType,
    linkEntityPublicId: row.linkEntityPublicId,
    isRead: row.readAt != null,
    createdAt: row.createdAt.toISOString(),
    url: link?.path ?? '/notifications',
    exists: link?.exists ?? true,
  }
}

async function requireUserId(): Promise<string> {
  const request = getRequest()
  const session = await auth.getSession(request.headers)
  if (!session.ok) throw new Error('UNAUTHORIZED')
  return session.value.user.id
}

export async function listNotifications(data: {
  tab: NotificationsTab
  page: number
}): Promise<NotificationsPage> {
  const userId = await requireUserId()

  const where = and(eq(notifications.userId, userId), tabFilter(data.tab))

  const rows = await db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((data.page - 1) * PAGE_SIZE)

  const unreadRows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))

  const hasMore = rows.length > PAGE_SIZE

  return {
    items: rows.slice(0, PAGE_SIZE).map(toItem),
    tab: data.tab,
    page: data.page,
    pageSize: PAGE_SIZE,
    hasMore,
    unreadCount: unreadRows.at(0)?.count ?? 0,
  }
}

export async function unreadCount(): Promise<{ count: number }> {
  const userId = await requireUserId()

  const rows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))

  return { count: rows.at(0)?.count ?? 0 }
}

export async function markRead(publicId: string): Promise<{ success: true }> {
  const userId = await requireUserId()

  // Recipient scoping: a user can only mark their own notifications.
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.publicId, publicId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    )

  return { success: true }
}

export async function markAllRead(tab: NotificationsTab): Promise<{ success: true }> {
  const userId = await requireUserId()

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), tabFilter(tab)))

  return { success: true }
}
