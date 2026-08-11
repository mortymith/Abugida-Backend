import {
  pgTable,
  bigint,
  uuid,
  jsonb,
  text,
  timestamp,
  inet,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { users } from '../auth/users'
export const securityEventTypeEnum = z.enum([
  'failed_login',
  'account_lockout',
  'suspicious_ip',
  'token_reuse',
  'rate_limit_exceeded',
  'permission_denied',
])
export type SecurityEventType = z.infer<typeof securityEventTypeEnum>
export const securityEventTypePgEnum = pgEnum('security_event_type', [
  'failed_login',
  'account_lockout',
  'suspicious_ip',
  'token_reuse',
  'rate_limit_exceeded',
  'permission_denied',
])
export const severityLevelEnum = z.enum(['info', 'warning', 'critical'])
export type SeverityLevel = z.infer<typeof severityLevelEnum>
export const severityLevelPgEnum = pgEnum('severity_level', ['info', 'warning', 'critical'])
export const securityEvents = pgTable(
  'security_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    publicId: uuid('public_id').notNull().defaultRandom().unique(),
    eventType: securityEventTypePgEnum(),
    actorId: bigint('actor_id', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    actorIp: inet('actor_ip'),
    severity: severityLevelPgEnum().default('info'),
    description: text('description').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    retentionExpiresAt: timestamp('retention_expires_at', {
      withTimezone: true,
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_security_events_public').on(table.publicId),
    index('idx_security_events_type_time').on(table.eventType, table.createdAt),
    index('idx_security_events_severity_time').on(table.severity, table.createdAt),
    index('idx_security_events_time').on(table.createdAt),
    index('idx_security_events_retention').on(table.retentionExpiresAt),
  ],
)
export const securityEventsRelations = relations(securityEvents, ({ one }) => ({
  actor: one(users, {
    fields: [securityEvents.actorId],
    references: [users.id],
  }),
}))
export const insertSecurityEventSchema = createInsertSchema(securityEvents, {
  eventType: securityEventTypeEnum,
  actorId: z.number().positive().nullable().optional(),
  actorIp: z.string().nullable().optional(),
  severity: severityLevelEnum.default('info'),
  description: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
  retentionExpiresAt: z.date().nullable().optional(),
}).omit({
  publicId: true,
})
export const selectSecurityEventSchema = createSelectSchema(securityEvents)
export type InsertSecurityEvent = z.infer<typeof insertSecurityEventSchema>
export type SelectSecurityEvent = z.infer<typeof selectSecurityEventSchema>
