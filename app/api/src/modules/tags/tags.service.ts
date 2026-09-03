/**
 * @module tags.service
 *
 * Business logic for the tags feature module.
 */

import type { TagsRepository } from './tags.repository'
import { encodeCursor } from './tags.repository'
import type { TagView, TagCourseListQuery } from './tags.types'

// ── Service ────────────────────────────────────────────────────────────────

export interface TagsService {
  listTags(): Promise<{
    data: TagView[]
  }>
  listCoursesByTag(
    tagId: string,
    query: TagCourseListQuery,
  ): Promise<{
    data: Array<{
      courseId: string
      title: string
      slug: string
      description: string | null
      thumbnailUrl: string | null
      isFree: boolean
      status: string | null
    }>
    meta: { cursor: string | null; hasMore: boolean; limit: number }
  }>
}

export function createTagsService(repo: TagsRepository): TagsService {
  return {
    async listTags() {
      const rows = await repo.findAll()
      return {
        data: rows.map((row) => ({
          id: row.publicId,
          name: row.name,
          slug: row.slug,
          description: row.description,
        })),
      }
    },

    async listCoursesByTag(tagId, query) {
      const limit = query.limit ?? 20
      const { rows, hasMore } = await repo.findCoursesByTag(tagId, {
        cursor: query.cursor,
        limit,
      })

      const data = rows.map((row) => ({
        courseId: row.coursePublicId,
        title: row.title,
        slug: row.slug,
        description: row.description,
        thumbnailUrl: row.thumbnailObjectKey,
        isFree: row.isFree,
        status: row.status,
      }))

      const lastRow = rows[rows.length - 1]
      return {
        data,
        meta: {
          cursor: hasMore && lastRow ? encodeCursor(lastRow.courseId) : null,
          hasMore,
          limit,
        },
      }
    },
  }
}
