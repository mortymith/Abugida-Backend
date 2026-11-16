/**
 * @module bookmarks.types
 *
 * TypeScript interfaces for the bookmarks feature module.
 */

export interface BookmarkView {
  id: string
  itemType: string
  itemId: string
  createdAt: string
}

export interface BookmarkCreateFields {
  itemType: string
  itemId: string
}

export interface BookmarkListQuery {
  cursor: string | undefined
  limit: number | undefined
}
