import type { QuestionType } from './schemas/courses.learning.schema'
import type { ReviewState } from './schemas/courses.workflow.schema'
import type { AuthoringHealth } from './courses.readiness'
/**
 * Course status is the five-state lifecycle (spec 04 Revision 3), owned by
 * `courses.workspace.ts` so there is one definition. It must stay assignable
 * from `courseStatusEnum` in @abugida/database plus the derived `approved` state.
 */
import type { CourseLifecycleState } from './courses.workspace'

/** Shared DTOs between server functions and UI components (spec 04). */

/**
 * S-A.1 navigation badges: `total` open review submissions in the workspace
 * (the Courses badge) and `assignedToMe`, the share the signed-in reviewer can
 * actually decide — the ones they did not author, per the self-approval guard.
 */
export interface PendingReviewCounts {
  total: number
  assignedToMe: number
}

export interface CourseCatalogItem {
  publicId: string
  title: string
  description: string | null
  thumbnailObjectKey: string | null
  /**
   * The **stored** status, not the five-state lifecycle. `Approved` is derived
   * from `approvedAt` so the catalog's Approved filter can match
   * `review_requests.entity_type = 'course' AND decision = 'approved' AND
   * status = 'draft'` exactly as the spec states.
   */
  status: CourseLifecycleState
  /** Set by an approval decision; cleared on withdrawal, edit, or unpublish. */
  approvedAt: string | null
  /** A future `scheduled_publish_at` earns the **Scheduled** filter. */
  scheduledPublishAt: string | null
  courseType: 'self_paced' | 'instructor_led' | 'hybrid'
  level: 'beginner' | 'intermediate' | 'advanced' | null
  isFree: boolean
  priceAmount: string | null
  priceCurrency: string
  instructorName: string | null
  moduleCount: number
  lessonCount: number
  studentCount: number
  averageRating: number | null
  updatedAt: string
  requiresApproval: boolean
  /**
   * S-2.1 authoring health. Read from the same readiness projection that backs
   * `RC-3`/`RC-4` in S-2.22, so a card can never disagree with the checklist.
   */
  authoringHealth: AuthoringHealth
  /** Counts backing the Approved/Scheduled filters, so pills can show totals. */
  statusCounts: CatalogStatusCounts
}

/** Per-status totals for the S-2.1 filter pills. */
export interface CatalogStatusCounts {
  all: number
  draft: number
  inReview: number
  approved: number
  scheduled: number
  published: number
  archived: number
}

export interface CourseCatalogResult {
  items: CourseCatalogItem[]
  totalCount: number
  page: number
  pageSize: number
}

export interface CourseFormReference {
  examTypes: Array<{ id: number; publicId: string; name: string }>
  instructors: Array<{ id: string; name: string; email: string; image: string | null }>
  gateways: Array<{
    publicId: string
    displayName: string
    providerName: string | null
    isEnabled: boolean
  }>
}

export interface CurriculumLessonDTO {
  id: number
  publicId: string
  title: string
  sortOrder: number
  contentType: 'pdf' | 'video' | 'quiz' | 'exercise' | 'link' | null
  reviewStatus: 'draft' | 'in_review' | 'changes_requested' | 'approved'
  /**
   * Per-item visibility (spec 04 § Item visibility). Read by the sidebar so it
   * can render the `◌ Unpublished` / `📅 Scheduled` pill without a second fetch,
   * and by the readiness projection that defines the **published set**.
   */
  visibility: 'draft' | 'published' | 'scheduled'
  /** When a `scheduled` item becomes visible; ignored for the other values. */
  scheduledPublishAt: string | null
  archivedAt: string | null
  deletedAt: string | null
  hasBody: boolean
  hasQuiz: boolean
  hasUnlockRules: boolean
  studentCount: number
  videoUrl: string | null
  durationMinutes: number | null
}

export interface CurriculumModuleDTO {
  id: number
  publicId: string
  title: string
  description: string | null
  sortOrder: number
  lessons: CurriculumLessonDTO[]
}

export interface CurriculumDTO {
  coursePublicId: string
  modules: CurriculumModuleDTO[]
}

export interface CourseDetailsDTO {
  publicId: string
  title: string
  description: string | null
  examTypeId: number
  examTypeName: string | null
  instructorId: string | null
  instructorName: string | null
  courseType: 'self_paced' | 'instructor_led' | 'hybrid'
  level: 'beginner' | 'intermediate' | 'advanced' | null
  thumbnailObjectKey: string | null
  /** The stored four-value status. Use `approvedAt` to derive the fifth state. */
  status: CourseLifecycleState
  /** Set by an approval decision; the fifth lifecycle state is derived from it. */
  approvedAt: string | null
  slug: string
  requiresApproval: boolean
  scheduledPublishAt: string | null
  publishedAt: string | null
  enrollmentStartAt: string | null
  enrollmentEndAt: string | null
  isFree: boolean
  priceAmount: string | null
  priceCurrency: string
  /** Default language for this course's authored content (S-2.20). */
  contentLanguage: 'en' | 'am' | 'ti' | 'gez'
  /** Monotonic publication version; publishing increments it (S-2.22). */
  version: number
  /** Optimistic-concurrency guard for every `rowVersion`-checked write. */
  rowVersion: number
  createdAt: string
  updatedAt: string
}

export interface CoursePricingDTO {
  model: 'free' | 'one_time' | 'subscription'
  priceAmount: string | null
  priceCurrency: string
  billingPeriod: 'monthly' | 'quarterly' | 'annual' | null
  enrollmentStartAt: string | null
  enrollmentEndAt: string | null
  earlyBird: { percentage: string; endsAt: string | null } | null
  bulk: { percentage: string; minEnrollments: number | null } | null
  gatewayOptions: Array<{
    gatewayPublicId: string
    displayName: string
    providerName: string | null
    isEnabled: boolean
    configured: boolean
    purchaseOptionPublicId: string | null
  }>
}

export interface QuizOptionDTO {
  publicId: string | null
  optionText: string
  isCorrect: boolean
}

export interface QuizQuestionDTO {
  publicId: string | null
  questionType: QuestionType
  questionText: string
  points: number
  explanation: string | null
  options: QuizOptionDTO[]
  correctAnswer: string | null
}

export interface QuizDTO {
  publicId: string | null
  lessonPublicId: string
  title: string
  passingScorePercent: number
  timeLimitMinutes: number | null
  maxAttempts: number | null
  isPublished: boolean
  questions: QuizQuestionDTO[]
}

export interface UnlockRuleDTO {
  publicId: string
  requiredLessonPublicId: string
  requiredLessonTitle: string
  condition: 'viewed' | 'completed' | 'quiz_score'
  thresholdPercent: number | null
  hasQuiz: boolean
}

export interface UnlockRulesDTO {
  lessonPublicId: string
  lessonTitle: string
  enabled: boolean
  lockBehavior: 'hidden' | 'visible_locked'
  customMessage: string | null
  rules: UnlockRuleDTO[]
  candidateRequirements: Array<{
    lessonPublicId: string
    lessonTitle: string
    hasQuiz: boolean
  }>
}

export interface ReviewQueueItem {
  reviewPublicId: string
  lessonPublicId: string | null
  lessonTitle: string | null
  coursePublicId: string
  courseTitle: string
  requesterName: string | null
  state: ReviewState
  /**
   * Which kind of subject the request targets (spec 04 S-2.14). `course` rows
   * have `lessonPublicId = null` and gate whole-course publication; `item` rows
   * point at one curriculum row.
   */
  entityType: 'course' | 'item'
  submissionNote: string | null
  decisionComment: string | null
  decidedByName: string | null
  submittedAt: string
  decidedAt: string | null
}

export interface ReviewLessonPreview {
  lessonPublicId: string
  lessonTitle: string
  body: string | null
  videoUrl: string | null
  contentType: string | null
  durationMinutes: number | null
  quiz: { title: string; questions: Array<{ questionText: string; options: string[] }> } | null
}

export interface CourseTemplateDTO {
  publicId: string
  name: string
  slug: string
  description: string | null
  category: string
  moduleCount: number
  lessonCount: number
  quizCount: number
  isFeatured: boolean
  structure: TemplateStructure
}

/**
 * Canonical lesson content types, mirrored from the `content_type` Postgres
 * enum. Template structures live in a JSONB column, so anything read back is
 * untrusted and may contain legacy/out-of-enum values — always run it through
 * `normalizeTemplateContentType` before writing it to `lessons.contentType`.
 */
export const TEMPLATE_CONTENT_TYPES = ['pdf', 'video', 'quiz', 'exercise', 'link'] as const
export type TemplateContentType = (typeof TEMPLATE_CONTENT_TYPES)[number]

export interface TemplateLesson {
  title: string
  contentType: string
  body: string | null
  videoUrl: string | null
  durationMinutes: number | null
  quizSeed?: { questionText: string; correctAnswer: string; options: string[] } | null
}

export interface TemplateModule {
  title: string
  description: string | null
  lessons: TemplateLesson[]
}

export interface TemplateStructure {
  modules: TemplateModule[]
}

export interface AiOutlineLesson {
  title: string
  format: 'video' | 'reading' | 'quiz' | 'exercise'
  durationMinutes: number
  quizSeed?: { questionText: string; correctAnswer: string; options: string[] } | null
  needsContent: boolean
}

export interface AiOutlineModule {
  title: string
  description: string
  lessons: AiOutlineLesson[]
}

export interface AiOutlineResult {
  jobPublicId: string
  provider: string
  title: string
  description: string
  modules: AiOutlineModule[]
}

export interface AiQuizQuestionDraft {
  questionType: QuestionType
  questionText: string
  options: Array<{ optionText: string; isCorrect: boolean }>
  correctAnswer: string | null
  explanation: string | null
  points: number
}

export interface AiQuizDraft {
  jobPublicId: string
  provider: string
  questions: AiQuizQuestionDraft[]
}

export interface LiveSessionDTO {
  publicId: string
  title: string
  description: string | null
  scheduledAt: string
  durationMinutes: number | null
  hostId: string | null
  hostName: string | null
  provider: 'zoom' | 'google_meet' | 'custom'
  joinUrl: string | null
  autoRecord: boolean
  reminder24h: boolean
  reminder1h: boolean
  attendeeCount: number
  status: 'scheduled' | 'completed' | 'cancelled'
  recordingLessonId: number | null
}

export interface CompletionSettingsDTO {
  rule: 'all_lessons' | 'min_percent_quiz'
  minPercent: number
  autoIssue: boolean
  certificate: {
    title: string
    showStudentName: boolean
    showCourseTitle: boolean
    showCompletionDate: boolean
    showSignature: boolean
    signatureObjectKey: string | null
    signatureLabel: string | null
  } | null
}

export interface CourseStudentRow {
  enrollmentPublicId: string
  studentName: string
  studentEmail: string
  progressPercentage: string
  isCompleted: boolean
  completedAt: string | null
  lastAccessedAt: string | null
}

export interface CourseStudentsResult {
  items: CourseStudentRow[]
  totalCount: number
}

export interface CourseAnalyticsDTO {
  studentCount: number
  activeStudents7d: number
  averageRating: number | null
  ratingCount: number
  completionRate: number | null
  moduleBreakdown: Array<{
    moduleTitle: string
    lessonCount: number
    avgProgress: number | null
  }>
}

export interface ImportPreview {
  columns: string[]
  rows: string[][]
}

export interface ImportValidation {
  moduleCount: number
  lessonCount: number
  warnings: Array<{ rowIndex: number; message: string }>
  skipped: Array<{ rowIndex: number; message: string }>
}

export interface ImportRunResult {
  jobPublicId: string
  coursePublicId: string
  moduleCount: number
  lessonCount: number
  undoExpiresAt: string
}

export interface PendingReviewsBadge {
  count: number
}
