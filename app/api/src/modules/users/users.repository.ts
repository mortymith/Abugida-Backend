/**
 * @module users.repository
 *
 * Database operations for the users feature module. All queries use Drizzle
 * ORM with the shared schema bindings from `@abugida/database`.
 *
 * The `users` table IS the better-auth `user` model: `users.id` is the
 * better-auth-owned text id that session resolution returns, so lookups are
 * keyed directly on `users.id` (string) — there is no separate public id or
 * numeric surrogate anymore.
 */

import { eq, and, desc, sql } from 'drizzle-orm'
import type { DatabaseClient } from '@abugida/database/client'
import { users, userProfiles, devices, userConsents } from '@abugida/database/auth'

// ── Types ──────────────────────────────────────────────────────────────────

export interface UserRepository {
  findUserById(id: string): Promise<UserRow[]>
  findUserProfileByUserId(userId: string): Promise<ProfileRow[]>
  findUserWithProfile(id: string): Promise<UserWithProfile | undefined>
  updateUserById(id: string, fields: Record<string, unknown>): Promise<void>
  updateUserProfileByUserId(userId: string, fields: Record<string, unknown>): Promise<void>
  setOnboardingStep(userId: string, step: number): Promise<void>
  completeOnboarding(userId: string): Promise<void>
  getConsents(userId: string): Promise<ConsentRow[]>
  upsertConsents(
    userId: string,
    consents: Array<{
      consentType: string
      consentVersion: string
      isGranted: boolean
    }>,
  ): Promise<void>
  getDevices(userId: string): Promise<DeviceRow[]>
  findDeviceByPublicId(userId: string, devicePublicId: string): Promise<DeviceRow | undefined>
  createDevice(
    userId: string,
    fields: {
      deviceIdentifier: string
      deviceName?: string
      platform?: string
      osVersion?: string
      appVersion?: string
    },
  ): Promise<DeviceRow>
  updateDevice(
    userId: string,
    devicePublicId: string,
    fields: { deviceName?: string; isActive?: boolean },
  ): Promise<DeviceRow | undefined>
  deleteDevice(userId: string, devicePublicId: string): Promise<boolean>
  getDeviceCount(userId: string): Promise<number>
  getMaxDevices(userId: string): Promise<number>
}

// ── Row types ──────────────────────────────────────────────────────────────

type UserRow = typeof users.$inferSelect
type ProfileRow = typeof userProfiles.$inferSelect
type DeviceRow = typeof devices.$inferSelect
type ConsentRow = typeof userConsents.$inferSelect

export interface UserWithProfile {
  user: UserRow
  profile: ProfileRow | null
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createUserRepository(db: DatabaseClient): UserRepository {
  return {
    async findUserById(id) {
      return db.select().from(users).where(eq(users.id, id)).limit(1)
    },

    async findUserProfileByUserId(userId) {
      return db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1)
    },

    async findUserWithProfile(id) {
      const [row] = await db
        .select({
          user: users,
          profile: userProfiles,
        })
        .from(users)
        .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(eq(users.id, id))
        .limit(1)

      if (!row) return undefined
      return { user: row.user, profile: row.profile }
    },

    async updateUserById(id, fields) {
      await db.update(users).set(fields).where(eq(users.id, id))
    },

    async updateUserProfileByUserId(userId, fields) {
      await db.update(userProfiles).set(fields).where(eq(userProfiles.userId, userId))
    },

    async setOnboardingStep(userId, step) {
      await db
        .update(userProfiles)
        .set({ onboardingStep: step })
        .where(eq(userProfiles.userId, userId))
    },

    async completeOnboarding(userId) {
      await db
        .update(userProfiles)
        .set({ isOnboardingCompleted: true })
        .where(eq(userProfiles.userId, userId))
    },

    async getConsents(userId) {
      return db
        .select()
        .from(userConsents)
        .where(eq(userConsents.userId, userId))
        .orderBy(desc(userConsents.consentedAt))
    },

    async upsertConsents(userId, consents) {
      for (const consent of consents) {
        await db
          .insert(userConsents)
          .values({
            userId,
            consentType: consent.consentType as
              'essential' | 'analytics' | 'personalization' | 'marketing' | 'third_party_sharing',
            consentVersion: consent.consentVersion,
            isGranted: consent.isGranted,
          })
          .onConflictDoNothing({
            target: [userConsents.userId, userConsents.consentType, userConsents.consentVersion],
          })
      }
    },

    async getDevices(userId) {
      return db
        .select()
        .from(devices)
        .where(eq(devices.userId, userId))
        .orderBy(desc(devices.lastActiveAt))
    },

    async findDeviceByPublicId(userId, devicePublicId) {
      const [device] = await db
        .select()
        .from(devices)
        .where(and(eq(devices.userId, userId), eq(devices.publicId, devicePublicId)))
        .limit(1)
      return device
    },

    async createDevice(userId, fields) {
      const [device] = await db
        .insert(devices)
        .values({
          userId,
          deviceIdentifier: fields.deviceIdentifier,
          deviceName: fields.deviceName ?? null,
          platform: (fields.platform as 'ios' | 'android' | 'web' | null) ?? null,
          osVersion: fields.osVersion ?? null,
          appVersion: fields.appVersion ?? null,
        })
        .returning()
      return device!
    },

    async updateDevice(userId, devicePublicId, fields) {
      const [device] = await db
        .update(devices)
        .set(fields)
        .where(and(eq(devices.userId, userId), eq(devices.publicId, devicePublicId)))
        .returning()
      return device
    },

    async deleteDevice(userId, devicePublicId) {
      const [deleted] = await db
        .delete(devices)
        .where(and(eq(devices.userId, userId), eq(devices.publicId, devicePublicId)))
        .returning()
      return !!deleted
    },

    async getDeviceCount(userId) {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(devices)
        .where(eq(devices.userId, userId))
      return result?.count ?? 0
    },

    async getMaxDevices(userId) {
      const [result] = await db
        .select({ maxDevices: users.maxDevices })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      return result?.maxDevices ?? 3
    },
  }
}
