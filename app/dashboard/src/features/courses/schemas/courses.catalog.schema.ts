import { z } from 'zod'

/**
 * S-2.1 filter pills.
 *
 * `approved` and `scheduled` are **derived** buckets, not `courses.status`
 * values, so they are listed explicitly alongside the lifecycle states:
 * dropping them from the enum would silently remove two pills from the catalog.
 * `approved` matches an approved course-level review request on a draft course;
 * `scheduled` matches any course with a future `scheduled_publish_at`.
 */
export const CATALOG_STATUS_FILTERS = [
  'all',
  'draft',
  'in_review',
  'approved',
  'scheduled',
  'published',
  'archived',
] as const

export const catalogStatusSchema = z.enum(CATALOG_STATUS_FILTERS)
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
