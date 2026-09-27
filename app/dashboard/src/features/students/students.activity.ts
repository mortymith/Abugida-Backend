import type { StudentActivityItem, StudentActivityKind } from './students.types'

/**
 * Pure activity-feed merge for S-4.2 (Activity Log tab). The server impl
 * collects rows from enrollments, lesson completions, quiz attempts, badge
 * awards and certificates; this module unifies + sorts + caps them.
 */

export interface ActivitySourceRow {
  id: string
  kind: StudentActivityKind
  title: string
  detail?: string | null
  courseTitle?: string | null
  at: string
}

const MAX_FEED_ITEMS = 50

export function mergeActivityFeed(rows: ActivitySourceRow[]): StudentActivityItem[] {
  return rows
    .filter((row) => !Number.isNaN(new Date(row.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, MAX_FEED_ITEMS)
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      detail: row.detail ?? null,
      courseTitle: row.courseTitle ?? null,
      at: row.at,
    }))
}

export const ACTIVITY_KIND_LABELS: Record<StudentActivityKind, string> = {
  enrolled: 'Enrolled',
  lesson_completed: 'Lesson completed',
  quiz_attempt: 'Quiz attempt',
  badge_awarded: 'Badge earned',
  certificate_issued: 'Certificate earned',
}
