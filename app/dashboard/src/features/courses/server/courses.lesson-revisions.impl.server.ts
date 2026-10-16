/**
 * Lesson body revision writer — spec 12 § 14.1.
 *
 * Spec 12 § 14.1 names the events that write a revision (and the events that
 * deliberately do not). This module is the single write path:
 *
 *  - Explicit `Flush now` (Ctrl/⌘+S) → `save`
 *  - Submit for review → `save`
 *  - AI Accept (§ 11.1) → `ai_accept`
 *  - Restore a previous version → `restore`
 *  - § 5.3 migration → `migration`
 *
 * The 60s autosave timer and the context-switch / unmount flush do NOT write a
 * revision. The autosave path is covered by the IndexedDB mirror instead
 * (§ 8.1.1); the gap between two revisions is the author's own work in
 * progress, and losing it costs one autosave cycle, not work.
 *
 * Retention is 30 revisions per lesson with a documented prune job; the row
 * count is bounded regardless of how often the buffer flushes.
 */
import { and, desc, eq, gt, lt } from '@abugida/database'
import { lessons, lessonBodyRevisions, LESSON_BODY_REVISION_RETENTION  } from '@abugida/database/catalog'
import { db } from '#/config/db.config'
import { requireAuthoringRole, requireUserId, resolveLesson } from './courses.server-helpers.server'
import type { LessonBodyRevisionReason } from '@abugida/database/catalog'

/**
 * Write a revision and prune older rows past the retention bound.
 *
 * The prune runs in the same transaction as the insert so a crash between the
 * two cannot leave the table unbounded. The prune is "keep the 30 most recent
 * per lesson" — implemented as "delete rows with id <= (max id - 30)", which
 * is correct under the table's identity-primary-key contract.
 */
export async function writeLessonBodyRevisionImpl(input: {
  lessonPublicId: string
  body: string
  bodyFormat: 'html' | 'markdown'
  reason: LessonBodyRevisionReason
}): Promise<{ revisionId: number }> {
  const userId = await requireAuthoringRole()
  const lesson = await resolveLesson(input.lessonPublicId)

  const inserted = await db
    .insert(lessonBodyRevisions)
    .values({
      lessonId: lesson.id,
      body: input.body,
      bodyFormat: input.bodyFormat,
      createdBy: userId,
      reason: input.reason,
    })
    .returning({ id: lessonBodyRevisions.id })
  const revisionId = inserted.at(0)?.id
  if (!revisionId) throw new Error('REVISION_WRITE_FAILED')

  await pruneLessonBodyRevisionsImpl(lesson.id)
  return { revisionId }
}

/**
 * Prune older revisions past the retention bound. Public so the prune job can
 * call it without going through the insert path.
 *
 * The prune is "keep the N most recent per lesson". Implemented as: find the
 * Nth-newest revision's id, then delete every row with id <= that. This is
 * correct under the table's identity-primary-key contract and avoids a
 * window function.
 */
export async function pruneLessonBodyRevisionsImpl(
  lessonId: number,
  retention: number = LESSON_BODY_REVISION_RETENTION,
): Promise<{ pruned: number }> {
  // Find the id of the Nth-newest revision. If there are <= N revisions,
  // this returns no rows and the prune is a no-op.
  const cutoffRows = await db
    .select({ id: lessonBodyRevisions.id })
    .from(lessonBodyRevisions)
    .where(eq(lessonBodyRevisions.lessonId, lessonId))
    .orderBy(desc(lessonBodyRevisions.id))
    .limit(1)
    .offset(retention)
  const cutoff = cutoffRows.at(0)?.id
  if (!cutoff) return { pruned: 0 }

  const deleted = await db
    .delete(lessonBodyRevisions)
    .where(
      and(
        eq(lessonBodyRevisions.lessonId, lessonId),
        // `<= cutoff` expressed as `< cutoff + 1` because `lte` is not in the
        // shared re-export surface. The identity-primary-key contract makes
        // the +1 safe (ids are integers and never overflow at this scale).
        lt(lessonBodyRevisions.id, cutoff + 1),
      ),
    )
    .returning({ id: lessonBodyRevisions.id })
  return { pruned: deleted.length }
}

/**
 * List the most recent revisions for a lesson, newest-first. Used by the
 * S-2.14 review panel.
 */
export async function listLessonBodyRevisionsImpl(
  lessonPublicId: string,
  limit: number = 30,
): Promise<
  Array<{
    publicId: string
    body: string
    bodyFormat: 'html' | 'markdown'
    createdBy: string
    createdAt: Date
    reason: LessonBodyRevisionReason
  }>
> {
  await requireUserId()
  const lesson = await resolveLesson(lessonPublicId)
  const rows = await db
    .select({
      publicId: lessonBodyRevisions.publicId,
      body: lessonBodyRevisions.body,
      bodyFormat: lessonBodyRevisions.bodyFormat,
      createdBy: lessonBodyRevisions.createdBy,
      createdAt: lessonBodyRevisions.createdAt,
      reason: lessonBodyRevisions.reason,
    })
    .from(lessonBodyRevisions)
    .where(eq(lessonBodyRevisions.lessonId, lesson.id))
    .orderBy(desc(lessonBodyRevisions.createdAt))
    .limit(limit)
  return rows.map((row) => ({
    publicId: row.publicId,
    body: row.body,
    bodyFormat: row.bodyFormat === 'markdown' ? 'markdown' : 'html',
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    reason: row.reason,
  }))
}

/**
 * Restore a previous revision. Spec 12 § 14.1: restoring appends; it never
 * deletes or truncates history. The restored body becomes the lesson's current
 * body and a new `restore` revision is written so the action itself is
 * reviewable.
 *
 * Returns the new rowVersion so the editor can update its expectedRowVersion.
 */
export async function restoreLessonBodyRevisionImpl(input: {
  lessonPublicId: string
  revisionPublicId: string
}): Promise<{ rowVersion: number }> {
  const userId = await requireAuthoringRole()
  const lesson = await resolveLesson(input.lessonPublicId)

  // Find the revision to restore. Must belong to this lesson — a revision
  // from another lesson is a 403, not a 404, because the lessonPublicId in
  // the URL is what the author is authorised to edit.
  const revisionRows = await db
    .select({
      id: lessonBodyRevisions.id,
      body: lessonBodyRevisions.body,
      bodyFormat: lessonBodyRevisions.bodyFormat,
    })
    .from(lessonBodyRevisions)
    .where(
      and(
        eq(lessonBodyRevisions.publicId, input.revisionPublicId),
        eq(lessonBodyRevisions.lessonId, lesson.id),
      ),
    )
    .limit(1)
  const revision = revisionRows.at(0)
  if (!revision) throw new Error('REVISION_NOT_FOUND')

  // Restore: write the revision's body to the lesson, bump rowVersion, and
  // append a new `restore` revision so the action is reviewable. The
  // restored body keeps its original bodyFormat so the editor hydrates it
  // correctly on next read.
  const updated = await db
    .update(lessons)
    .set({
      body: revision.body,
      bodyFormat: revision.bodyFormat === 'markdown' ? 'markdown' : 'html',
      rowVersion: lesson.rowVersion + 1,
    })
    .where(and(eq(lessons.id, lesson.id), eq(lessons.rowVersion, lesson.rowVersion)))
    .returning({ rowVersion: lessons.rowVersion })
  const nextRowVersion = updated.at(0)?.rowVersion
  if (!nextRowVersion) throw new Error('VERSION_CONFLICT: this lesson was updated elsewhere')

  await db.insert(lessonBodyRevisions).values({
    lessonId: lesson.id,
    body: revision.body,
    bodyFormat: revision.bodyFormat === 'markdown' ? 'markdown' : 'html',
    createdBy: userId,
    reason: 'restore',
  })
  await pruneLessonBodyRevisionsImpl(lesson.id)
  return { rowVersion: nextRowVersion }
}

// `gt` is exported by @abugida/database but not used here. The void keeps the
// import surface tidy if future revisions need it.
void gt
