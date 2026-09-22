import type { BadgeTriggerConfig, BadgeTrigger, BadgeStatus } from '@abugida/database/learning'
import type { MessageAttachment } from '@abugida/database/ops'

/**
 * DTOs for the Students feature (spec 06). All timestamps are ISO strings —
 * server functions serialize before crossing the server/client boundary.

 * `id` on student rows is the Better Auth `users.id` (the global-search /
 * entity-links contract for `/students/{id}`), while enrollment-, cohort-,
 * badge- and rule-shaped rows carry their own `publicId`.
 */

export type StudentAccountStatus =
  'pending_verification' | 'active' | 'locked' | 'suspended' | 'deleted'

export type StudentSort = 'name' | 'joined' | 'last_active' | 'courses' | 'progress'

export interface StudentDirectoryItem {
  id: string
  name: string
  email: string
  status: StudentAccountStatus
  courseCount: number
  avgProgress: number | null
  lastActivityAt: string | null
  joinedAt: string
}

export interface StudentDirectoryPage {
  items: StudentDirectoryItem[]
  page: number
  pageSize: number
  totalRows: number
  hasNextPage: boolean
}

/** S-4.1 stats row: totals, weekly activity split, engagement depth. */
export interface StudentDirectoryStats {
  totalStudents: number
  activeThisWeek: number
  inactiveThisWeek: number
  avgCoursesPerUser: number | null
}

export interface StudentProfile {
  id: string
  name: string
  email: string
  status: StudentAccountStatus
  joinedAt: string
  lastLoginAt: string | null
  lastActivityAt: string | null
  /** Only the last 4 digits are ever exposed (encrypted at rest upstream). */
  phoneLast4: string | null
  tags: string[]
  courseCount: number
  completedCount: number
  avgProgress: number | null
}

export interface StudentCourseRow {
  enrollmentPublicId: string
  coursePublicId: string
  courseTitle: string
  progressPercentage: number
  isCompleted: boolean
  completedLessons: number
  totalLessons: number
  lastAccessedAt: string | null
  enrolledAt: string
}

export type StudentActivityKind =
  'enrolled' | 'lesson_completed' | 'quiz_attempt' | 'badge_awarded' | 'certificate_issued'

export interface StudentActivityItem {
  id: string
  kind: StudentActivityKind
  title: string
  detail: string | null
  courseTitle: string | null
  at: string
}

/** S-4.3 per-course breakdown card. */
export interface StudentProgressCourse {
  coursePublicId: string
  courseTitle: string
  progressPercentage: number
  isCompleted: boolean
  lastQuizScorePercent: number | null
  timeInvestedHours: number
  /** Cumulative completion count over time for the trend sparkline. */
  trend: Array<{ date: string; completed: number }>
}

export interface StudentProgressBadge {
  badgePublicId: string
  name: string
  icon: string | null
  description: string | null
  source: 'automatic' | 'manual'
  awardedAt: string
}

export interface StudentProgressDTO {
  overallCompletion: number | null
  currentStreakDays: number
  longestStreakDays: number
  timeInvestedHours: number
  lastActivityAt: string | null
  /** 🟠 At-risk flag: inactive 14+ days while having uncompleted courses. */
  isAtRisk: boolean
  hasAnyActivity: boolean
  courses: StudentProgressCourse[]
  certificates: Array<{ courseTitle: string; serial: string; issuedAt: string }>
  badges: StudentProgressBadge[]
}

// ── Cohorts (S-4.4) ─────────────────────────────────────────────────────

export interface CohortCard {
  publicId: string
  name: string
  description: string | null
  startedAt: string | null
  memberCount: number
  avgProgress: number | null
  createdAt: string
}

export interface CohortMemberRow {
  studentId: string
  name: string
  email: string
  avgProgress: number | null
  addedAt: string
}

// ── Messaging (S-4.5) ───────────────────────────────────────────────────

export interface MessageThreadItem {
  publicId: string
  studentId: string
  studentName: string
  studentEmail: string
  kind: 'direct' | 'broadcast'
  subject: string | null
  lastMessageAt: string
  lastMessagePreview: string | null
  unreadStaffCount: number
}

export interface MessageThreadPage {
  items: MessageThreadItem[]
  page: number
  pageSize: number
  totalRows: number
  hasNextPage: boolean
}

export interface MessageItem {
  publicId: string
  senderId: string
  senderName: string
  isStaff: boolean
  body: string
  attachments: MessageAttachment[]
  createdAt: string
}

// ── Enrollment requests / waitlist (S-4.6) ──────────────────────────────

export interface EnrollmentRequestItem {
  publicId: string
  studentId: string
  studentName: string
  studentEmail: string
  coursePublicId: string
  courseTitle: string
  requestedAt: string
  note: string | null
}

export interface WaitlistOverviewItem {
  coursePublicId: string
  courseTitle: string
  capacity: number | null
  activeEnrollments: number
  waitingCount: number
  nextStudent: { studentId: string; studentName: string } | null
}

// ── Badges (S-4.7) ──────────────────────────────────────────────────────

export type { BadgeTrigger, BadgeStatus, BadgeTriggerConfig }

export interface BadgeCard {
  publicId: string
  name: string
  description: string | null
  icon: string | null
  triggerKind: BadgeTrigger
  triggerDays: number | null
  status: BadgeStatus
  awardCount: number
  lastAwardedAt: string | null
  createdAt: string
}

export interface BadgeAwardRow {
  publicId: string
  badgeName: string
  badgeIcon: string | null
  studentId: string
  studentName: string
  source: 'automatic' | 'manual'
  note: string | null
  awardedAt: string
}

export interface TriggerPreviewResult {
  matchedCount: number
  sample: Array<{ id: string; name: string; email: string }>
}

// ── Automated enrollment rules (S-4.8) ──────────────────────────────────

export interface RuleRunSummary {
  matched: number
  enrolled: number
  skipped: number
  failed: number
}

export interface EnrollmentRuleRow {
  publicId: string
  name: string
  triggerKind: 'course_completed' | 'tag_added' | 'cohort_assigned' | 'account_created'
  /** Human-readable trigger, e.g. "TOEFL Complete completed" or "Tag = acme-2026". */
  triggerLabel: string
  targetCoursePublicId: string
  targetCourseTitle: string
  minQuizAvgPercent: number | null
  sendWelcomeEmail: boolean
  status: 'draft' | 'active' | 'paused'
  lastRunAt: string | null
  lastRunSummary: RuleRunSummary | null
}

export interface RuleRunRow extends RuleRunSummary {
  publicId: string
  runKind: 'event' | 'sweep' | 'manual' | 'dry_run'
  ranAt: string
  details: Array<{ name: string; outcome: string; reason: string }> | null
}

export interface DryRunItem {
  studentId: string
  studentName: string
  outcome: 'will_enroll' | 'will_skip'
  reason: string
}

export interface DryRunResult {
  matched: number
  willEnroll: number
  willSkip: number
  items: DryRunItem[]
}

/** Shared reference data for editors: courses + cohorts + recent tags. */
export interface StudentsReference {
  courses: Array<{
    publicId: string
    title: string
    isFree: boolean
    priceLabel: string | null
    requiresApproval: boolean
    capacity: number | null
    activeEnrollments: number
  }>
  cohorts: Array<{ publicId: string; name: string }>
  tags: Array<{ tag: string; count: number }>
}
