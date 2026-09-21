import type { QuestionType } from './schemas/courses.learning.schema'
import type { ReviewState } from './schemas/courses.workflow.schema'

/** Shared DTOs between server functions and UI components (spec 04). */

export interface CourseCatalogItem {
  publicId: string
  title: string
  description: string | null
  thumbnailObjectKey: string | null
  status: 'draft' | 'published' | 'archived'
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
  status: 'draft' | 'published' | 'archived'
  slug: string
  requiresApproval: boolean
  scheduledPublishAt: string | null
  publishedAt: string | null
  enrollmentStartAt: string | null
  enrollmentEndAt: string | null
  isFree: boolean
  priceAmount: string | null
  priceCurrency: string
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
  lessonPublicId: string
  lessonTitle: string
  coursePublicId: string
  courseTitle: string
  requesterName: string | null
  state: ReviewState
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

export interface TemplateLesson {
  title: string
  contentType: 'pdf' | 'video' | 'quiz' | 'exercise' | 'link'
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
