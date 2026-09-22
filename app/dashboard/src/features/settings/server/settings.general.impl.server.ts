/**
 * Server-only implementation of S-6.1 General Settings: platform, course,
 * and notification preferences persisted in system_configs (the repo's
 * system-settings model). Never import from client code.
 */
import { and, eq, isNull, sql } from '@abugida/database'
import { examTypes } from '@abugida/database/catalog'
import { member, users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  readConfigKeys,
  requireSettingsAdmin,
  upsertConfigKey,
  writeAudit,
} from './settings.server-helpers.server'
import type {
  GeneralSettings,
  GeneralSettingsReference,
  GeneralSettingsSaveResult,
} from '../settings.types'
import type { SaveGeneralSettingsInput } from '../schemas/settings.schema'

const KEYS = {
  platformName: 'platform.name',
  supportEmail: 'platform.support_email',
  timezone: 'platform.timezone',
  dateFormat: 'platform.date_format',
  defaultInstructor: 'courses.default_instructor',
  defaultCategory: 'courses.default_category',
  autoNotify: 'notifications.auto_notify_publication',
  dailyDigest: 'notifications.daily_digest',
} as const

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function id(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export async function getGeneralSettingsImpl(): Promise<GeneralSettings> {
  await requireSettingsAdmin()

  const config = await readConfigKeys(Object.values(KEYS))
  return {
    platformName: str(config[KEYS.platformName]),
    supportEmail: str(config[KEYS.supportEmail]),
    timezone: str(config[KEYS.timezone]),
    dateFormat: str(config[KEYS.dateFormat]),
    defaultInstructorId: id(config[KEYS.defaultInstructor]),
    defaultCategoryId: (typeof config[KEYS.defaultCategory] === 'number'
      ? config[KEYS.defaultCategory]
      : null) as number | null,
    autoNotifyOnPublication: bool(config[KEYS.autoNotify]),
    dailyDigestEmails: bool(config[KEYS.dailyDigest]),
    availability: 'ok',
  }
}

/** Default-instructor options: staff who can author courses (admins/editors). */
export async function getGeneralSettingsReferenceImpl(): Promise<GeneralSettingsReference> {
  await requireSettingsAdmin()

  const instructors = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .innerJoin(member, eq(member.userId, users.id))
    .where(
      and(
        isNull(users.deletedAt),
        sql`(${member.role} LIKE '%admin%' OR ${member.role} LIKE '%owner%' OR ${member.role} LIKE '%editor%')`,
      ),
    )
    .orderBy(users.name)

  const categories = await db
    .select({ id: examTypes.id, name: examTypes.name })
    .from(examTypes)
    .where(eq(examTypes.isActive, true))
    .orderBy(examTypes.sortOrder, examTypes.name)

  return {
    instructors: instructors.map((row) => ({
      id: row.id,
      name: row.name ?? row.email ?? row.id,
    })),
    categories: categories.map((row) => ({ id: row.id, name: row.name })),
  }
}

export async function saveGeneralSettingsImpl(
  input: SaveGeneralSettingsInput,
): Promise<GeneralSettingsSaveResult> {
  const adminId = await requireSettingsAdmin()

  const writes: Array<Parameters<typeof upsertConfigKey>[0]> = [
    {
      key: KEYS.platformName,
      value: input.platformName,
      category: 'general',
      description: 'Workspace display name (S-6.1)',
    },
    {
      key: KEYS.supportEmail,
      value: input.supportEmail,
      category: 'general',
      description: 'Support contact email shown to students',
    },
    {
      key: KEYS.timezone,
      value: input.timezone,
      category: 'general',
      description: 'Default reporting timezone (S-6.1)',
    },
    {
      key: KEYS.dateFormat,
      value: input.dateFormat,
      category: 'general',
      description: 'Default date format (S-6.1)',
    },
    {
      key: KEYS.defaultInstructor,
      value: input.defaultInstructorId,
      category: 'courses',
      description: 'Preselected instructor for new courses',
    },
    {
      key: KEYS.defaultCategory,
      value: input.defaultCategoryId,
      category: 'courses',
      description: 'Preselected category for new courses',
    },
    {
      key: KEYS.autoNotify,
      value: input.autoNotifyOnPublication,
      category: 'notifications',
      description: 'Auto-notify enrolled students on course publication',
    },
    {
      key: KEYS.dailyDigest,
      value: input.dailyDigestEmails,
      category: 'notifications',
      description: 'Daily digest emails to staff',
    },
  ]
  for (const write of writes) await upsertConfigKey(write)

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: { screen: 'S-6.1', action: 'save_general_settings' },
  })

  return { ok: true, updatedAt: new Date().toISOString() }
}
