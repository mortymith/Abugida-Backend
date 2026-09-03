/**
 * @module enrollments.types
 *
 * TypeScript interfaces for the enrollments feature module.
 */

// ── Progress ───────────────────────────────────────────────────────────────

export interface ProgressStats {
  totalEnrollments: number
  activeEnrollments: number
  completedEnrollments: number
  totalLessonsCompleted?: number
  totalStudyTimeSeconds?: number
}

// ── Enrollments ────────────────────────────────────────────────────────────

export interface EnrollmentView {
  id: string
  courseId: string
  purchaseId: string | null
  bundleId: string | null
  enrollmentSource: string
  progressPercentage: number
  isCompleted: boolean
  completedAt: string | null
  lastAccessedAt: string | null
  createdAt: string
}

export interface EnrollmentDetailView extends EnrollmentView {
  totalLessons: number
  completedLessons: number
  rowVersion: number
}

// ── Lesson Completions ─────────────────────────────────────────────────────

export interface LessonCompletionView {
  id: string
  lessonId: string
  enrollmentId: string
  isCompleted: boolean
  completedAt: string | null
  timeSpentSeconds: number | null
  createdAt: string
  updatedAt: string
}

export interface LessonCompletionToggle {
  isCompleted: boolean
  timeSpentSeconds?: number
}

// ── Query options ──────────────────────────────────────────────────────────

export interface EnrollmentListQuery {
  cursor: string | undefined
  limit: number | undefined
  status: string | undefined
  source: string | undefined
}

export interface LessonCompletionListQuery {
  cursor: string | undefined
  limit: number | undefined
}
