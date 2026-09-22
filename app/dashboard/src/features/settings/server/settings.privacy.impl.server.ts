/**
 * Server-only implementation of S-6.10 Privacy & Data Retention.
 * Retention policies persist in system_configs (category 'privacy'); match
 * previews are real queries against user activity; the data-request queue
 * uses the ops.data_requests table; exports build a JSON archive of the
 * student's own records; erasure walks the users deletion lifecycle (request
 * → completion) while retaining financial rows per spec. Every run, export,
 * and erasure writes an audit entry. Never import from client code.
 */
import { and, count, desc, eq, isNull, sql } from '@abugida/database'
import { enrollments, lessonCompletions, quizAttempts } from '@abugida/database/learning'
import { courses } from '@abugida/database/catalog'
import { dataRequests } from '@abugida/database/ops'
import { userConsents, users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  readConfigKeys,
  requireSettingsAdmin,
  upsertConfigKey,
  writeAudit,
} from './settings.server-helpers.server'
import { inactivityCutoff, matchesInactivity } from '../settings.retention'
import type { StudentActivityRecord } from '../settings.retention'
import { slaDeadline } from '../settings.sla'
import type {
  ConsentLogPage,
  DataRequestItem,
  DataRequestsPage,
  PrivacyPage,
  RetentionPreview,
  RetentionPolicy,
} from '../settings.types'
import type {
  CreateDataRequestInput,
  DataRequestIdInput,
  SaveRetentionPolicyInput,
  TypedEraseInput,
} from '../schemas/settings.schema'

const POLICY_KEY = 'privacy.retention_policy'
const CONSENT_PAGE_SIZE = 25

function readPolicy(value: unknown): RetentionPolicy {
  const source = (value ?? {}) as Partial<RetentionPolicy>
  return {
    anonymizeEnabled: source.anonymizeEnabled ?? false,
    anonymizeInactivityMonths: source.anonymizeInactivityMonths ?? 12,
    warningEmailDays: source.warningEmailDays ?? 14,
    deleteEnabled: source.deleteEnabled ?? false,
    deleteInactivityMonths: source.deleteInactivityMonths ?? 24,
    scopeProfile: source.scopeProfile ?? true,
    scopeMessages: source.scopeMessages ?? true,
    scopeCertificates: source.scopeCertificates ?? false,
  }
}

export async function getPrivacyPageImpl(): Promise<PrivacyPage> {
  await requireSettingsAdmin()
  const stored = (await readConfigKeys([POLICY_KEY]))[POLICY_KEY]
  return { policy: readPolicy(stored), availability: 'ok' }
}

export async function saveRetentionPolicyImpl(
  input: SaveRetentionPolicyInput,
): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()

  await upsertConfigKey({
    key: POLICY_KEY,
    value: input satisfies RetentionPolicy,
    category: 'privacy',
    description: 'Retention policies: inactivity thresholds, action scope, warning email (S-6.10)',
  })

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: { screen: 'S-6.10', action: 'save_retention_policy' },
  })
  return { ok: true }
}

/** Students (non-staff, not deleted) with their latest activity timestamps. */
async function loadStudentActivity(): Promise<StudentActivityRecord[]> {
  const rows = await db
    .select({
      userId: users.id,
      lastLoginAt: users.lastLoginAt,
      lastEnrollmentActivityAt: sql<Date | null>`(SELECT MAX(${enrollments.lastAccessedAt}) FROM ${enrollments}
         WHERE ${enrollments.studentId} = ${users.id} AND ${enrollments.deletedAt} IS NULL)`,
    })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        sql`NOT EXISTS (SELECT 1 FROM "member" WHERE "member"."user_id" = ${users.id})`,
      ),
    )
  return rows
}

export async function previewRetentionMatchesImpl(): Promise<RetentionPreview> {
  await requireSettingsAdmin()

  const stored = (await readConfigKeys([POLICY_KEY]))[POLICY_KEY]
  const policy = readPolicy(stored)
  const records = await loadStudentActivity()
  const now = new Date()

  const anonymizeCutoff = inactivityCutoff(now, policy.anonymizeInactivityMonths)
  const deleteCutoff = inactivityCutoff(now, policy.deleteInactivityMonths)

  const anonymizeMatches = policy.anonymizeEnabled
    ? records.filter((record) => matchesInactivity(record, anonymizeCutoff))
    : []
  const deleteMatches = policy.deleteEnabled
    ? records.filter((record) => matchesInactivity(record, deleteCutoff))
    : []

  const sampleRows = await Promise.all(
    anonymizeMatches.slice(0, 10).map(async (record) => {
      const rows = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, record.userId))
        .limit(1)
      const row = rows.at(0)
      return {
        id: record.userId,
        name: row?.name ?? 'Unnamed student',
        email: row?.email ?? '',
        lastActiveAt:
          (record.lastLoginAt ?? record.lastEnrollmentActivityAt)?.toISOString() ?? null,
      }
    }),
  )

  return {
    anonymizeMatchCount: anonymizeMatches.length,
    deleteMatchCount: deleteMatches.length,
    anonymizeSample: sampleRows,
  }
}

export async function getDataRequestsImpl(): Promise<DataRequestsPage> {
  await requireSettingsAdmin()

  const rows = await db
    .select({
      publicId: dataRequests.publicId,
      studentId: dataRequests.studentId,
      studentName: users.name,
      studentEmail: users.email,
      requestType: dataRequests.requestType,
      status: dataRequests.status,
      requestedAt: dataRequests.requestedAt,
      completedAt: dataRequests.completedAt,
    })
    .from(dataRequests)
    .innerJoin(users, eq(users.id, dataRequests.studentId))
    .orderBy(desc(dataRequests.requestedAt))

  const now = new Date()
  const items: DataRequestItem[] = rows.map((row) => {
    const deadline = slaDeadline(row.requestedAt)
    const daysLeft = Math.floor((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    return {
      publicId: row.publicId,
      studentId: row.studentId,
      studentName: row.studentName ?? 'Unnamed student',
      studentEmail: row.studentEmail ?? '',
      requestType: row.requestType as 'export' | 'delete',
      status: row.status as 'open' | 'completed',
      requestedAt: row.requestedAt.toISOString(),
      slaDeadline: deadline.toISOString(),
      slaDaysLeft: daysLeft,
      slaWarning: daysLeft <= 5,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    }
  })

  return {
    items,
    availability: items.length === 0 ? 'no_data' : 'ok',
  }
}

export async function createDataRequestImpl(input: CreateDataRequestInput): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()

  // Students are users; the directory's public id is the user UUID. Reject
  // staff accounts and unknown ids.
  const studentRows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, input.studentPublicId),
        isNull(users.deletedAt),
        sql`NOT EXISTS (SELECT 1 FROM "member" WHERE "member"."user_id" = ${users.id})`,
      ),
    )
    .limit(1)
  const student = studentRows.at(0)
  if (!student) throw new Error('STUDENT_NOT_FOUND')

  await db.insert(dataRequests).values({
    studentId: student.id,
    requestType: input.requestType,
    status: 'open',
  })

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: {
      screen: 'S-6.10',
      action: 'create_data_request',
      studentId: student.id,
      requestType: input.requestType,
    },
  })
  return { ok: true }
}

export async function completeDataExportImpl(
  input: DataRequestIdInput,
): Promise<{ fileName: string; json: string }> {
  const adminId = await requireSettingsAdmin()

  const requestRows = await db
    .select({
      id: dataRequests.id,
      studentId: dataRequests.studentId,
      requestType: dataRequests.requestType,
      status: dataRequests.status,
    })
    .from(dataRequests)
    .where(eq(dataRequests.publicId, input.publicId))
    .limit(1)
  const request = requestRows.at(0)
  if (!request) throw new Error('REQUEST_NOT_FOUND')
  if (request.requestType !== 'export') throw new Error('REQUEST_TYPE_MISMATCH')
  if (request.status !== 'open') throw new Error('REQUEST_ALREADY_COMPLETED')

  const studentId = request.studentId

  const [profileRows, enrollmentRows, completionRows, attemptRows] = await Promise.all([
    db
      .select({
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1),
    db
      .select({
        course: courses.title,
        progress: enrollments.progressPercentage,
        createdAt: enrollments.createdAt,
        completedAt: enrollments.completedAt,
      })
      .from(enrollments)
      .innerJoin(courses, eq(courses.id, enrollments.courseId))
      .where(eq(enrollments.studentId, studentId)),
    db
      .select({
        completedAt: lessonCompletions.completedAt,
        timeSpentSeconds: lessonCompletions.timeSpentSeconds,
      })
      .from(lessonCompletions)
      .where(eq(lessonCompletions.studentId, studentId))
      .limit(5000),
    db
      .select({
        score: quizAttempts.quizScorePercentage,
        isPassed: quizAttempts.isPassed,
        startedAt: quizAttempts.startedAt,
      })
      .from(quizAttempts)
      .where(eq(quizAttempts.studentId, studentId))
      .limit(5000),
  ])

  const archive = {
    generatedAt: new Date().toISOString(),
    profile: profileRows.at(0) ?? null,
    enrollments: enrollmentRows,
    lessonCompletions: completionRows,
    quizAttempts: attemptRows,
  }

  await db
    .update(dataRequests)
    .set({ status: 'completed', completedAt: new Date(), completedBy: adminId })
    .where(eq(dataRequests.id, request.id))

  await writeAudit({
    actorId: adminId,
    action: 'data_export',
    resourceType: 'user_account',
    metadata: {
      screen: 'S-6.10',
      action: 'student_data_export',
      studentId,
      requestId: input.publicId,
    },
  })

  return {
    fileName: `student-data-export-${input.publicId.slice(0, 8)}.json`,
    json: JSON.stringify(archive, null, 2),
  }
}

/**
 * Verified erasure (spec: verify identity → typed "ERASE" → irreversible).
 * Executes the users deletion lifecycle: sets deletion_requested_at and
 * completes it (grace semantics live in the schema's lifecycle columns).
 * Nulls PII, preserves rows so historical analytics stay reproducible.
 * Financial rows are retained per spec ("invoices/transactions are retained").
 */
export async function eraseStudentDataImpl(input: TypedEraseInput): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()

  const requestRows = await db
    .select({
      id: dataRequests.id,
      studentId: dataRequests.studentId,
      requestType: dataRequests.requestType,
      status: dataRequests.status,
    })
    .from(dataRequests)
    .where(eq(dataRequests.publicId, input.publicId))
    .limit(1)
  const request = requestRows.at(0)
  if (!request) throw new Error('REQUEST_NOT_FOUND')
  if (request.requestType !== 'delete') throw new Error('REQUEST_TYPE_MISMATCH')
  if (request.status !== 'open') throw new Error('REQUEST_ALREADY_COMPLETED')

  const studentId = request.studentId
  const now = new Date()

  // Irreversible lifecycle write — the "ERASE" typed confirmation happened
  // client-side and is re-asserted by the validator's literal schema.
  await db
    .update(users)
    .set({
      deletionRequestedAt: now,
      deletionCompletedAt: now,
      deletedAt: now,
      name: null,
      email: null,
      image: null,
      phoneNumberEncrypted: null,
      phoneNumberHash: null,
      phoneNumberLast4: null,
      accountStatus: 'deleted',
    })
    .where(eq(users.id, studentId))

  await db
    .update(dataRequests)
    .set({ status: 'completed', completedAt: now, completedBy: adminId })
    .where(eq(dataRequests.id, request.id))

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: {
      screen: 'S-6.10',
      action: 'student_data_erasure',
      studentId,
      requestId: input.publicId,
      financialRowsRetained: true,
    },
  })
  return { ok: true }
}

export async function getConsentLogImpl(input: { page?: number }): Promise<ConsentLogPage> {
  await requireSettingsAdmin()

  const page = input.page ?? 1
  const consentUsers = users

  const [rows, totals] = await Promise.all([
    db
      .select({
        publicId: userConsents.publicId,
        studentName: consentUsers.name,
        studentEmail: consentUsers.email,
        consentType: userConsents.consentType,
        consentVersion: userConsents.consentVersion,
        isGranted: userConsents.isGranted,
        consentedAt: userConsents.consentedAt,
      })
      .from(userConsents)
      .innerJoin(consentUsers, eq(consentUsers.id, userConsents.userId))
      .orderBy(desc(userConsents.consentedAt))
      .limit(CONSENT_PAGE_SIZE)
      .offset((page - 1) * CONSENT_PAGE_SIZE),
    db.select({ total: count() }).from(userConsents),
  ])

  const total = Number(totals.at(0)?.total ?? 0)

  return {
    items: rows.map((row) => ({
      publicId: row.publicId,
      studentName: row.studentName ?? 'Unnamed student',
      studentEmail: row.studentEmail ?? '',
      consentType: row.consentType ?? 'essential',
      consentVersion: row.consentVersion,
      isGranted: row.isGranted,
      consentedAt: row.consentedAt.toISOString(),
    })),
    page,
    pageSize: CONSENT_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / CONSENT_PAGE_SIZE)),
  }
}
