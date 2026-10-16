/**
 * Conflict-resolution server implementation — spec 12 § 8.2.
 *
 * Revision 3 of spec 12 closes the destructive-only alternative. "Keep mine"
 * is the default resolution and must be **auditable**: the spec says the
 * override logs the actor, the lesson, both rowVersions, and a timestamp to
 * the audit log. This module implements that log entry alongside the
 * server-side re-stamp of `expectedRowVersion`.
 *
 * The actual write retry is handled by `saveLesson` itself, called by the
 * editor after the author picks "Keep mine" — the editor re-fetches the
 * server row, takes its rowVersion, and submits the local body with that
 * fresh `expectedRowVersion`. The retry is single-shot; a second 409 re-opens
 * the dialog rather than looping.
 */
import { auditLogs } from '@abugida/database/ops'
import { db } from '#/config/db.config'
import { requireUserId, resolveLesson } from './courses.server-helpers.server'

/**
 * Record a "Keep mine" override in the audit log.
 *
 * The audit log's `metadata` column carries both rowVersions so a reviewer
 * can see exactly which version the author overrode. We deliberately use
 * `admin_action` rather than introducing a new enum value — extending the
 * `audit_action` pgEnum would require a separate migration and a new code
 * path in every consumer, and the metadata is sufficient for review.
 */
export async function recordLessonConflictOverrideImpl(input: {
  lessonPublicId: string
  /** The rowVersion the author's stale save was based on. */
  localRowVersion: number
  /** The rowVersion the server reported back via the 409. */
  serverRowVersion: number
  /** Which resolution the author picked. */
  resolution: 'keep_mine' | 'take_theirs'
}): Promise<void> {
  const userId = await requireUserId()
  const lesson = await resolveLesson(input.lessonPublicId)

  await db.insert(auditLogs).values({
    actorId: userId,
    action: 'admin_action',
    resourceType: 'lesson',
    lessonId: lesson.id,
    courseId: lesson.courseId,
    metadata: {
      kind: 'lesson_conflict_override',
      resolution: input.resolution,
      localRowVersion: input.localRowVersion,
      serverRowVersion: input.serverRowVersion,
      // ISO 8601 with offset, per Part 11 § Date & Time Formatting.
      timestamp: new Date().toISOString(),
    },
  })
}

/**
 * Re-fetch the server's current rowVersion for one lesson.
 *
 * Called by the editor after the author picks "Keep mine": the editor needs
 * the server's current rowVersion so its retry save uses the right
 * `expectedRowVersion`. This is the re-stamp step from § 8.2.
 */
export async function getLessonServerRowVersionImpl(
  lessonPublicId: string,
): Promise<{ rowVersion: number; body: string | null; bodyFormat: 'html' | 'markdown' }> {
  await requireUserId()
  const lesson = await resolveLesson(lessonPublicId)
  return {
    rowVersion: lesson.rowVersion,
    body: lesson.body,
    bodyFormat: lesson.bodyFormat === 'markdown' ? 'markdown' : 'html',
  }
}

/**
 * Drop a lesson's IndexedDB draft from the server side is impossible — the
 * draft lives in the author's browser. This helper exists only to keep the
 * server's view of the world honest: when the author picks "Take theirs",
 * the editor calls this to confirm the server body the author is about to
 * hydrate is the one the server currently holds, before discarding the
 * local buffer. The actual IndexedDB clear is a client concern.
 */
export async function confirmServerBodyImpl(
  lessonPublicId: string,
  expectedRowVersion: number,
): Promise<{ ok: true; rowVersion: number; body: string | null } | { ok: false; rowVersion: number }> {
  await requireUserId()
  const lesson = await resolveLesson(lessonPublicId)
  if (lesson.rowVersion !== expectedRowVersion) {
    return { ok: false, rowVersion: lesson.rowVersion }
  }
  return { ok: true, rowVersion: lesson.rowVersion, body: lesson.body }
}
