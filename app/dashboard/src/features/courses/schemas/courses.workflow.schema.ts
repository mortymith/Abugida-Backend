import { z } from 'zod'
import { questionTypeSchema } from './courses.learning.schema'

/** S-2.14 review & approval queue. */
export const reviewStateSchema = z.enum(['pending', 'changes_requested', 'approved', 'rejected'])
export type ReviewState = z.infer<typeof reviewStateSchema>

export const reviewQueueQuerySchema = z.object({
  state: reviewStateSchema.default('pending'),
  coursePublicId: z.string().uuid().optional(),
})

export type ReviewQueueQuery = z.infer<typeof reviewQueueQuerySchema>

export const reviewDecisionSchema = z.enum(['approve', 'request_changes', 'reject'])
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>

export const reviewDecisionInputSchema = z.object({
  reviewPublicId: z.string().uuid(),
  decision: reviewDecisionSchema,
  comment: z.string().trim().max(2000).optional(),
})

export type ReviewDecisionInput = z.infer<typeof reviewDecisionInputSchema>

export const submitForReviewSchema = z.object({
  lessonPublicId: z.string().uuid(),
  note: z.string().trim().max(2000).optional(),
})

/** Per-course approval gating toggle (S-2.14 "Workflow gear", admin only). */
export const approvalGateSchema = z.object({
  coursePublicId: z.string().uuid(),
  requiresApproval: z.boolean(),
})

/** S-2.12 template library. */
export const TEMPLATE_CATEGORIES = [
  'all',
  'exam_prep',
  'corporate_training',
  'language',
  'onboarding',
  'workshops',
] as const
export const templateCategorySchema = z.enum(TEMPLATE_CATEGORIES)
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

export const templateQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  category: templateCategorySchema.default('all'),
})

export type TemplateQuery = z.infer<typeof templateQuerySchema>

export const useTemplateSchema = z.object({
  templatePublicId: z.string().uuid(),
})

export const saveAsTemplateSchema = z.object({
  coursePublicId: z.string().uuid(),
  name: z.string().trim().min(3).max(200),
  category: z.string().trim().min(1).max(100).default('general'),
})

/** S-2.13 bulk import. */
export const IMPORT_FIELD_SCHEMA = z.enum([
  'module',
  'lesson_title',
  'video_url',
  'content',
  'duration',
  'ignore',
])
export type ImportField = z.infer<typeof IMPORT_FIELD_SCHEMA>

export const importMappingSchema = z.record(z.string(), IMPORT_FIELD_SCHEMA)
export type ImportMapping = z.infer<typeof importMappingSchema>

export const parseImportFileSchema = z.object({
  fileName: z.string().trim().min(1).max(300),
  /** UTF-8 text for csv/md; base64 for xlsx/docx. */
  content: z.string().min(1),
})

export const validateImportSchema = z.object({
  fileName: z.string().trim().max(300).default(''),
  rows: z.array(z.array(z.string().nullable())),
  mapping: importMappingSchema,
})

export const runImportSchema = z.object({
  fileName: z.string().trim().max(300),
  /** Target an existing course, or provide a title to create a new shell. */
  coursePublicId: z.string().uuid().optional(),
  newCourseTitle: z.string().trim().max(300).optional(),
  rows: z.array(z.array(z.string().nullable())),
  mapping: importMappingSchema,
})

export const undoImportSchema = z.object({
  jobPublicId: z.string().uuid(),
})

/** S-2.11 AI course generator. */
export const aiOutlineRequestSchema = z.object({
  prompt: z.string().trim().min(10).max(2000),
  audience: z.string().trim().max(100).default('Adult learners'),
  level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  moduleCount: z.number().int().min(1).max(12).default(4),
  lessonsPerModule: z.number().int().min(1).max(8).default(3),
  language: z.string().trim().max(50).default('English'),
  includeQuizSeeds: z.boolean().default(true),
})

export type AiOutlineRequest = z.infer<typeof aiOutlineRequestSchema>

export const aiModuleRegenerateSchema = z.object({
  request: aiOutlineRequestSchema,
  moduleTitle: z.string().trim().max(300).optional(),
})

export const aiModuleExpandSchema = z.object({
  moduleTitle: z.string().trim().min(1).max(300),
  moduleDescription: z.string().trim().max(2000).optional(),
  count: z.number().int().min(1).max(8).default(3),
  request: aiOutlineRequestSchema,
})

/** S-2.16 AI quiz generator. */
export const aiQuizRequestSchema = z.object({
  lessonPublicId: z.string().uuid(),
  questionCount: z.number().int().min(1).max(20).default(5),
  types: z.array(questionTypeSchema).min(1).default(['multiple_choice', 'true_false']),
  difficulty: z.enum(['easy', 'mixed', 'hard']).default('mixed'),
})

export type AiQuizRequest = z.infer<typeof aiQuizRequestSchema>

export const aiQuizRegenerateSchema = aiQuizRequestSchema.extend({
  excludePrompts: z.array(z.string().max(500)).default([]),
})
