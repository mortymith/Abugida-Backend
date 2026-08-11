import {
  pgTable,
  bigint,
  uuid,
  varchar,
  timestamp,
  boolean,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from './users'
export const devicePlatformEnum = z.enum(['ios', 'android', 'web'])
export type DevicePlatform = z.infer<typeof devicePlatformEnum>
export const devicePlatformPgEnum = pgEnum('device_platform', ['ios', 'android', 'web'])
export const devices = pgTable(
  'devices',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    deviceIdentifier: varchar('device_identifier', { length: 255 }).notNull(),
    deviceName: varchar('device_name', { length: 100 }),
    platform: devicePlatformPgEnum(),
    osVersion: varchar('os_version', { length: 50 }),
    appVersion: varchar('app_version', { length: 20 }),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
    isActive: boolean('is_active').notNull().default(true),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('idx_devices_public').on(table.publicId),
    uniqueIndex('idx_devices_user_identifier').on(table.userId, table.deviceIdentifier),
    index('idx_devices_user_active').on(table.userId, table.lastActiveAt),
  ],
)
export const devicesRelations = relations(devices, ({ one }) => ({
  user: one(users, {
    fields: [devices.userId],
    references: [users.id],
  }),
}))
export const insertDeviceSchema = createInsertSchema(devices, {
  platform: devicePlatformEnum.nullable().optional(),
  deviceIdentifier: z.string().min(1).max(255),
  deviceName: z.string().max(100).nullable().optional(),
  isActive: z.boolean().default(true),
}).omit({
  publicId: true,
})
export const selectDeviceSchema = createSelectSchema(devices)
export const updateDeviceSchema = insertDeviceSchema.partial()
export type InsertDevice = z.infer<typeof insertDeviceSchema>
export type SelectDevice = z.infer<typeof selectDeviceSchema>
export type UpdateDevice = z.infer<typeof updateDeviceSchema>
