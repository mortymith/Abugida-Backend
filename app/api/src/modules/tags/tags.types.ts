/**
 * @module tags.types
 *
 * TypeScript interfaces for the tags feature module.
 */

export interface TagView {
  id: string
  name: string
  slug: string
  description: string | null
}

export interface TagCourseListQuery {
  cursor: string | undefined
  limit: number | undefined
}
