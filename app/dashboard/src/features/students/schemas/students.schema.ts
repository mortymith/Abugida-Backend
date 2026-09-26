import { z } from 'zod'

/**
 * Input validation for Students server functions (spec 06). Shared between
 * the client-safe wrappers (types) and the impl modules (parsing).
 */

export const STUDENTS_PAGE_SIZE = 25 // spec wireframe: "1-25 of 1,234 students"
export const MESSAGES_PAGE_SIZE = 30
export const COHORTS_PAGE_SIZE = 24
export const MAX_BULK = 200

export const studentSortSchema = z.enum(['name', 'joined', 'last_active', 'courses', 'progress'])
export type StudentSortValue = z.infer<typeof studentSortSchema>

export const accountStatusFilterSchema = z.enum([
  'all',
  'active',
  'pending_verification',
  'locked',
  'suspended',
])

export const directoryQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  /** 'all' = any course, else a course public id. */
  course: z.union([z.literal('all'), z.string().uuid()]).optional(),
  status: accountStatusFilterSchema.optional(),
  sort: studentSortSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
})
export type DirectoryQuery = z.infer<typeof directoryQuerySchema>

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(320)

/** S-4.1 Add Student — invite-based accounts never store passwords. */
export const createStudentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: emailSchema,
  /** Optional personal note stored in the audit trail, not on the user. */
  note: z.string().trim().max(500).optional(),
})
export type CreateStudentInput = z.infer<typeof createStudentSchema>

export const updateStudentSchema = z.object({
  studentId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  email: emailSchema,
})
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>

export const studentIdSchema = z.object({ studentId: z.string().uuid() })
export type StudentIdInput = z.infer<typeof studentIdSchema>

export const studentStatusSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(['active', 'locked', 'suspended']),
})
export type StudentStatusInput = z.infer<typeof studentStatusSchema>

export const unenrollSchema = z.object({
  studentId: z.string().uuid(),
  coursePublicId: z.string().uuid(),
})
export type UnenrollInput = z.infer<typeof unenrollSchema>

export const bulkStudentIdsSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(MAX_BULK),
})
export type BulkStudentIdsInput = z.infer<typeof bulkStudentIdsSchema>

export const bulkEnrollSchema = bulkStudentIdsSchema.extend({
  coursePublicId: z.string().uuid(),
  acknowledgedPaid: z.boolean().default(false),
})
export type BulkEnrollInput = z.infer<typeof bulkEnrollSchema>

// ── Tags ────────────────────────────────────────────────────────────────

export const addTagSchema = z.object({
  studentId: z.string().uuid(),
  tag: z.string().trim().min(1).max(60),
})
export type AddTagInput = z.infer<typeof addTagSchema>

export const removeTagSchema = addTagSchema
export type RemoveTagInput = AddTagInput

// ── Cohorts (S-4.4) ─────────────────────────────────────────────────────

export const cohortsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).optional(),
})
export type CohortsQuery = z.infer<typeof cohortsQuerySchema>

export const cohortCreateSchema = z.object({
  name: z.string().trim().min(1, 'Cohort name is required').max(200),
  description: z.string().trim().max(2_000).nullable(),
  startedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  studentIds: z.array(z.string().uuid()).max(MAX_BULK).default([]),
})
export type CohortCreateInput = z.infer<typeof cohortCreateSchema>

export const cohortUpdateSchema = cohortCreateSchema.omit({ studentIds: true })
export type CohortUpdateInput = z.infer<typeof cohortUpdateSchema>

export const cohortUpdateWithIdSchema = cohortUpdateSchema.extend({
  cohortPublicId: z.string().uuid(),
})
export type CohortUpdateWithIdInput = z.infer<typeof cohortUpdateWithIdSchema>

export const cohortMembersUpdateSchema = z.object({
  cohortPublicId: z.string().uuid(),
  addStudentIds: z.array(z.string().uuid()).max(MAX_BULK).default([]),
  removeStudentIds: z.array(z.string().uuid()).max(MAX_BULK).default([]),
})
export type CohortMembersUpdateInput = z.infer<typeof cohortMembersUpdateSchema>

export const cohortPublicIdSchema = z.object({ cohortPublicId: z.string().uuid() })
export type CohortPublicIdInput = z.infer<typeof cohortPublicIdSchema>

// ── Messaging (S-4.5) ───────────────────────────────────────────────────

export const threadsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  filter: z.enum(['all', 'unread', 'broadcast']).optional(),
  page: z.coerce.number().int().min(1).optional(),
})
export type ThreadsQuery = z.infer<typeof threadsQuerySchema>

export const attachmentSchema = z
  .object({
    kind: z.enum(['lesson', 'course', 'asset', 'link']),
    label: z.string().trim().min(1).max(200),
    entityPublicId: z.string().uuid().optional(),
    url: z.string().url().max(2_000).optional(),
  })
  .strict()

export const sendMessageSchema = z.object({
  /** Existing thread reply when threadPublicId is set. */
  threadPublicId: z.string().uuid().optional(),
  /** New direct thread when starting from a profile. */
  studentId: z.string().uuid().optional(),
  subject: z.string().trim().max(200).nullable().optional(),
  body: z.string().trim().min(1, 'Message cannot be empty').max(5_000),
  attachments: z.array(attachmentSchema).max(5).default([]),
})
export type SendMessageInput = z.infer<typeof sendMessageSchema>

export const broadcastSchema = z.object({
  cohortPublicId: z.string().uuid(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5_000),
  attachments: z.array(attachmentSchema).max(5).default([]),
  /** Client-confirmed recipient count from the broadcast preview. */
  confirmedCount: z.number().int().min(1).max(MAX_BULK),
})
export type BroadcastInput = z.infer<typeof broadcastSchema>

export const threadPublicIdSchema = z.object({ threadPublicId: z.string().uuid() })
export type ThreadPublicIdInput = z.infer<typeof threadPublicIdSchema>

export const markThreadReadInput = threadPublicIdSchema
export type MarkThreadReadInput = ThreadPublicIdInput

export const threadMessagesQuerySchema = z.object({
  threadPublicId: z.string().uuid(),
  page: z.coerce.number().int().min(1).optional(),
})
export type ThreadMessagesQuery = z.infer<typeof threadMessagesQuerySchema>

export const broadcastPreviewSchema = z.object({ cohortPublicId: z.string().uuid() })
export type BroadcastPreviewInput = z.infer<typeof broadcastPreviewSchema>

// ── Enrollment requests / waitlist (S-4.6) ──────────────────────────────

export const requestsQuerySchema = z.object({ q: z.string().trim().max(120).optional() })
export type RequestsQuery = z.infer<typeof requestsQuerySchema>

export const requestDecisionSchema = z.object({
  requestPublicId: z.string().uuid(),
  decisionNote: z.string().trim().max(500).optional(),
})
export type RequestDecisionInput = z.infer<typeof requestDecisionSchema>

export const bulkApproveSchema = z.object({
  requestPublicIds: z.array(z.string().uuid()).min(1).max(MAX_BULK),
})
export type BulkApproveInput = z.infer<typeof bulkApproveSchema>

export const promoteWaitlistSchema = z.object({
  coursePublicId: z.string().uuid(),
})
export type PromoteWaitlistInput = z.infer<typeof promoteWaitlistSchema>

// ── Badges (S-4.7) ──────────────────────────────────────────────────────

export const badgeTriggerInputSchema = z.discriminatedUnion('triggerKind', [
  z.object({ triggerKind: z.literal('first_lesson') }),
  z.object({ triggerKind: z.literal('streak'), days: z.number().int().min(1).max(365) }),
  z.object({ triggerKind: z.literal('quiz_perfect') }),
  z.object({ triggerKind: z.literal('course_completed') }),
  z.object({ triggerKind: z.literal('manual') }),
])
export type BadgeTriggerInput = z.infer<typeof badgeTriggerInputSchema>

export const badgeSaveSchema = z.object({
  badgePublicId: z.string().uuid().optional(), // set → edit
  name: z.string().trim().min(1, 'Badge name is required').max(120),
  description: z.string().trim().max(2_000).nullable(),
  icon: z.string().trim().max(16).nullable(),
  trigger: badgeTriggerInputSchema,
  notifyStudent: z.boolean().default(true),
})
export type BadgeSaveInput = z.infer<typeof badgeSaveSchema>

export const badgeStatusChangeSchema = z.object({
  badgePublicId: z.string().uuid(),
  status: z.enum(['active', 'paused', 'archived']),
})
export type BadgeStatusChangeInput = z.infer<typeof badgeStatusChangeSchema>

export const badgeAwardSchema = z.object({
  badgePublicId: z.string().uuid(),
  studentIds: z.array(z.string().uuid()).min(1).max(MAX_BULK),
  note: z.string().trim().max(500).optional(),
})
export type BadgeAwardInput = z.infer<typeof badgeAwardSchema>

export const badgeTriggerPreviewSchema = badgeTriggerInputSchema
export type BadgeTriggerPreviewInput = BadgeTriggerInput

export const badgeHistoryQuerySchema = z.object({
  badgePublicId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
})
export type BadgeHistoryQuery = z.infer<typeof badgeHistoryQuerySchema>

// ── Automated enrollment rules (S-4.8) ──────────────────────────────────

export const ruleTriggerInputSchema = z.discriminatedUnion('triggerKind', [
  z.object({
    triggerKind: z.literal('course_completed'),
    coursePublicId: z.string().uuid(),
  }),
  z.object({ triggerKind: z.literal('tag_added'), tag: z.string().trim().min(1).max(60) }),
  z.object({
    triggerKind: z.literal('cohort_assigned'),
    cohortPublicId: z.string().uuid(),
  }),
  z.object({ triggerKind: z.literal('account_created') }),
])
export type RuleTriggerInput = z.infer<typeof ruleTriggerInputSchema>

export const ruleSaveSchema = z.object({
  rulePublicId: z.string().uuid().optional(), // set → edit
  name: z.string().trim().min(1, 'Rule name is required').max(200),
  trigger: ruleTriggerInputSchema,
  targetCoursePublicId: z.string().uuid(),
  /** Optional AND condition: min average quiz % in the trigger course. */
  minQuizAvgPercent: z.number().int().min(1).max(100).nullable(),
  sendWelcomeEmail: z.boolean().default(false),
})
export type RuleSaveInput = z.infer<typeof ruleSaveSchema>

export const ruleStatusChangeSchema = z.object({
  rulePublicId: z.string().uuid(),
  status: z.enum(['draft', 'active', 'paused']),
})
export type RuleStatusChangeInput = z.infer<typeof ruleStatusChangeSchema>

export const ruleRunSchema = z.object({ rulePublicId: z.string().uuid() })
export type RuleRunInput = z.infer<typeof ruleRunSchema>

export const ruleDryRunSchema = z.object({
  /** Persisted rule dry-run. */
  rulePublicId: z.string().uuid().optional(),
  /** Unsaved editor state dry-run. */
  draft: ruleSaveSchema.omit({ rulePublicId: true }).optional(),
})
export type RuleDryRunInput = z.infer<typeof ruleDryRunSchema>

export const ruleRunsQuerySchema = z.object({ rulePublicId: z.string().uuid() })
export type RuleRunsQuery = z.infer<typeof ruleRunsQuerySchema>
