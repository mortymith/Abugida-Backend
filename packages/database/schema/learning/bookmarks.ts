import {
  pgTable,
  bigint,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'
import { courses } from '../catalog/courses'

export const bookmarkItemTypeEnum = z.enum(['course', 'resource'])
export type BookmarkItemType = z.infer<typeof bookmarkItemTypeEnum>
export const bookmarkItemTypePgEnum = pgEnum('bookmark_item_type', ['course', 'resource'])

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    itemType: bookmarkItemTypePgEnum().notNull().default('course'),
    itemId: bigint('item_id', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_bookmarks_public').on(table.publicId),
    index('idx_bookmarks_user').on(table.userId),
    uniqueIndex('idx_bookmarks_unique').on(table.userId, table.itemType, table.itemId),
    index('idx_bookmarks_user_created').on(table.userId, table.createdAt),
  ],
)

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [bookmarks.itemId],
    references: [courses.id],
  }),
}))

export const insertBookmarkSchema = createInsertSchema(bookmarks, {
  userId: z.number().positive(),
  itemType: bookmarkItemTypeEnum.default('course'),
  itemId: z.number().positive(),
}).omit({
  publicId: true,
})
export const selectBookmarkSchema = createSelectSchema(bookmarks)
export type InsertBookmark = z.infer<typeof insertBookmarkSchema>
export type SelectBookmark = z.infer<typeof selectBookmarkSchema>
