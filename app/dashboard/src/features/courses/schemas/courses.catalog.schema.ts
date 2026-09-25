import { z } from 'zod'

/** S-2.1 filter pills: status pills + course-type pills, plus search/sort. */
export const catalogStatusSchema = z.enum(['all', 'draft', 'published', 'archived'])
export type CatalogStatus = z.infer<typeof catalogStatusSchema>

export const catalogTypeSchema = z.enum(['all', 'self_paced', 'instructor_led', 'hybrid'])
export type CatalogType = z.infer<typeof catalogTypeSchema>

export const catalogSortSchema = z.enum(['recent', 'title', 'students'])
export type CatalogSort = z.infer<typeof catalogSortSchema>

export const catalogQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  /** `all` deliberately excludes archived courses (spec: hidden from default view). */
  status: catalogStatusSchema.default('all'),
  type: catalogTypeSchema.default('all'),
  sort: catalogSortSchema.default('recent'),
  page: z.number().int().min(0).default(0),
})

export type CatalogQuery = z.infer<typeof catalogQuerySchema>

export const COURSES_PAGE_SIZE = 24

export const coursePublicIdSchema = z.string().uuid()
