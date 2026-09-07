import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'
import { z } from 'zod'

export const jwks = pgTable(
  'jwks',
  {
    id: text('id').primaryKey(),
    publicKey: text('public_key').notNull(),
    privateKey: text('private_key').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'),
  },
  (table) => [index('idx_jwks_created_at').on(table.createdAt)],
)

export const insertJwksSchema = createInsertSchema(jwks)
export const selectJwksSchema = createSelectSchema(jwks)
export const updateJwksSchema = createUpdateSchema(jwks).partial()
export type InsertJwks = z.infer<typeof insertJwksSchema>
export type SelectJwks = z.infer<typeof selectJwksSchema>
export type UpdateJwks = z.infer<typeof updateJwksSchema>
