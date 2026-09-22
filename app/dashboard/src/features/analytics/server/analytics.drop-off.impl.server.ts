/**
 * Server-only implementation of S-5.3 Drop-off Analysis: enrollment funnel
 * (Enrolled → per-module done → Completed), steep-drop flags, biggest-drop
 * callout with lesson-level engagement for the dropped-into module.
 * Never import from client code.
 */
import { and, eq, isNull, sql } from '@abugida/database'
import { lessons, modules } from '@abugida/database/catalog'
import { enrollments, lessonCompletions } from '@abugida/database/learning'
import { db } from '#/config/db.config'
import { resolveDateRange } from '#/features/dashboard/schemas/dashboard.date-range.schema'
import type { AnalyticsRangeInput } from '../schemas/analytics.schema'
import { resolveCourse, getSessionRole } from './analytics.server-helpers.server'
import { buildFunnelSteps, findBiggestDrop } from '../analytics.metric-math'
import type { DropOffAnalytics, LessonEngagementRow } from '../analytics.types'

/** Watch-time is recorded as a per-student total only (no per-minute events). */
const HEATMAP_NOTE =
  'Per-minute watch-time heatmaps are not available yet — the platform records total time spent per student and lesson, shown here as an average share of runtime.'

export async function loadDropOffAnalytics(
  coursePublicId: string,
  input: AnalyticsRangeInput,
): Promise<DropOffAnalytics> {
  await getSessionRole()
  const course = await resolveCourse(coursePublicId)
  const range = resolveDateRange(input)
  const courseId = course.id

  // ── Funnel counts (all-time so the funnel matches the module table) ──
  const totalsRows = await db
    .select({
      enrolled: sql<number>`COUNT(*) FILTER (WHERE ${enrollments.deletedAt} IS NULL)::int`,
      completed: sql<number>`COUNT(*) FILTER (WHERE ${enrollments.deletedAt} IS NULL AND ${enrollments.isCompleted})::int`,
    })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
  const totals = totalsRows.at(0)
  const enrolled = totals?.enrolled ?? 0
  const completed = totals?.completed ?? 0

  const moduleRows = await db
    .select({
      internalId: modules.id,
      title: modules.title,
      lessonCount: sql<number>`(SELECT COUNT(*) FROM ${lessons} l WHERE l.module_id = ${modules.id} AND l.deleted_at IS NULL)::int`,
      completedStudents: sql<number>`(
        SELECT COUNT(*)::int FROM (
          SELECT lc.student_id
          FROM ${lessonCompletions} lc
          JOIN ${lessons} l ON l.id = lc.lesson_id
          WHERE l.module_id = ${modules.id}
            AND l.deleted_at IS NULL
            AND lc.is_completed
          GROUP BY lc.student_id
          HAVING COUNT(DISTINCT lc.lesson_id) =
            (SELECT COUNT(*) FROM ${lessons} l2 WHERE l2.module_id = ${modules.id} AND l2.deleted_at IS NULL)
        ) completers
      )`,
    })
    .from(modules)
    .where(and(eq(modules.courseId, courseId), isNull(modules.deletedAt)))
    .orderBy(modules.sortOrder)

  const moduleSteps = moduleRows
    .filter((row) => row.lessonCount > 0)
    .map((row) => ({ label: row.title, count: row.completedStudents }))
  const steps = buildFunnelSteps(enrolled, moduleSteps, completed)
  const biggestDrop = findBiggestDrop(steps)

  // ── Lesson engagement inside the module the biggest drop lands in ──
  // biggestDrop.toLabel names a module step (or the final "Completed" step, or
  // "Enrolled" when nothing dropped) — resolve the module by title, and fall
  // back to the last module when the drop lands on "Completed".
  const dropModuleTitle =
    biggestDrop == null
      ? null
      : biggestDrop.toLabel === 'Completed' || biggestDrop.toLabel === 'Enrolled'
        ? (moduleSteps.at(-1)?.label ?? null)
        : biggestDrop.toLabel
  const dropModule = dropModuleTitle
    ? moduleRows.find((row) => row.title === dropModuleTitle && row.lessonCount > 0)
    : undefined

  let likelyCauseLessons: LessonEngagementRow[] = []
  if (dropModule) {
    const rows = await db
      .select({
        lessonId: lessons.publicId,
        title: lessons.title,
        avgWatchPct: sql<string | null>`ROUND(
            100 * AVG(
              CASE
                WHEN ${lessons.durationSeconds} > 0 AND ${lessonCompletions.timeSpentSeconds} IS NOT NULL
                  THEN ${lessonCompletions.timeSpentSeconds}::numeric / ${lessons.durationSeconds}
                ELSE NULL
              END
            )::numeric, 1)::text`,
        completions: sql<number>`COUNT(${lessonCompletions.id}) FILTER (WHERE ${lessonCompletions.isCompleted})::int`,
      })
      .from(lessons)
      .leftJoin(lessonCompletions, eq(lessonCompletions.lessonId, lessons.id))
      .where(and(eq(lessons.moduleId, dropModule.internalId), isNull(lessons.deletedAt)))
      .groupBy(lessons.id)
      .orderBy(lessons.sortOrder)
    likelyCauseLessons = rows.map((row) => ({
      lessonId: row.lessonId,
      title: row.title,
      avgWatchPct: row.avgWatchPct == null ? null : Number(row.avgWatchPct),
      completions: row.completions,
    }))
  }

  return {
    course: { courseId: course.publicId, title: course.title },
    range: { from: range.from.toISOString(), to: range.to.toISOString(), label: range.label },
    steps,
    biggestDrop,
    likelyCauseLessons,
    heatmapNote: HEATMAP_NOTE,
    isEmpty: enrolled === 0,
  }
}
