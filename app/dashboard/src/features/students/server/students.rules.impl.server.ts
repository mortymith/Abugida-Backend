/**
 * Server-only implementation of S-4.8 Automated Enrollment Rules: the
 * WHEN/AND/THEN rule CRUD, dry-run preview, manual run + run log, and the
 * nightly sweep entry point. Matching semantics live in the pure
 * `students.rules-engine` module; enrollments are created exactly as manual
 * ones (source `admin_grant`) and are fully audited. Never import from
 * client code.
 */
import { and, desc, eq, inArray, isNull, sql } from '@abugida/database'
import { courses } from '@abugida/database/catalog'
import {
  cohortMembers,
  enrollments,
  enrollmentRules,
  enrollmentRuleRuns,
  studentTags,
} from '@abugida/database/learning'
import { users } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import {
  countActiveEnrollments,
  createEnrollmentInTx,
  createNotifications,
  requireStudentReadRole,
  requireStudentWriteRole,
} from './students.server-helpers.server'
import {
  evaluateRuleCandidates,
  toDryRunItems,
  validateRuleNotSelfLoop,
} from '../students.rules-engine'
import type { RuleCandidate } from '../students.rules-engine'
import type { RuleTrigger } from '@abugida/database/learning'
import type {
  RuleDryRunInput,
  RuleRunInput,
  RuleRunsQuery,
  RuleSaveInput,
  RuleStatusChangeInput,
} from '../schemas/students.schema'
import type { DryRunResult, EnrollmentRuleRow, RuleRunRow, RuleRunSummary } from '../students.types'

/** Trigger-keyed candidate set resolution shared by dry-run and run. */
async function resolveCandidates(rule: {
  triggerKind: RuleTrigger
  triggerCourseId: number | null
  triggerTag: string | null
  triggerCohortId: number | null
  targetCourseId: number
}): Promise<RuleCandidate[]> {
  const baseSelect = {
    studentId: users.id,
    studentName: users.name,
    quizAvgPercent: sql<number | null>`(
      SELECT AVG(qa.quiz_score_percentage) FROM quiz_attempts qa
      JOIN lessons l ON l.id = qa.lesson_id
      WHERE qa.student_id = ${users.id}
        AND qa.completed_at IS NOT NULL
        AND (${rule.triggerCourseId} IS NULL OR l.course_id = ${rule.triggerCourseId})
    )`,
  }

  if (rule.triggerKind === 'account_created') {
    const rows = await db
      .select(baseSelect)
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          sql`NOT EXISTS (SELECT 1 FROM "member" WHERE "member"."user_id" = ${users.id})`,
        ),
      )
      .limit(10_000)
    return rows.map((row) => ({
      studentId: row.studentId,
      studentName: row.studentName ?? 'Unnamed student',
      quizAvgPercent: row.quizAvgPercent == null ? null : Number(row.quizAvgPercent),
      alreadyEnrolledInTarget: false,
    }))
  }

  if (rule.triggerKind === 'course_completed') {
    const rows = await db
      .select(baseSelect)
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.studentId))
      .where(
        and(
          eq(enrollments.courseId, rule.triggerCourseId ?? -1),
          eq(enrollments.isCompleted, true),
          isNull(enrollments.deletedAt),
        ),
      )
      .limit(10_000)
    return rows.map(toCandidate)
  }

  if (rule.triggerKind === 'tag_added') {
    const rows = await db
      .select(baseSelect)
      .from(studentTags)
      .innerJoin(users, eq(users.id, studentTags.studentId))
      .where(
        and(
          sql`LOWER(${studentTags.tag}) = LOWER(${rule.triggerTag ?? ''})`,
          isNull(users.deletedAt),
        ),
      )
      .limit(10_000)
    return rows.map(toCandidate)
  }

  // cohort_assigned
  const rows = await db
    .select(baseSelect)
    .from(cohortMembers)
    .innerJoin(users, eq(users.id, cohortMembers.studentId))
    .where(and(eq(cohortMembers.cohortId, rule.triggerCohortId ?? -1), isNull(users.deletedAt)))
    .limit(10_000)
  return rows.map(toCandidate)

  function toCandidate(row: {
    studentId: string
    studentName: string | null
    quizAvgPercent: number | null
  }): RuleCandidate {
    return {
      studentId: row.studentId,
      studentName: row.studentName ?? 'Unnamed student',
      quizAvgPercent: row.quizAvgPercent == null ? null : Number(row.quizAvgPercent),
      alreadyEnrolledInTarget: false,
    }
  }
}

/** Filter out students already enrolled in the target course. */
async function withEnrollmentState(
  candidates: RuleCandidate[],
  targetCourseId: number,
): Promise<RuleCandidate[]> {
  if (candidates.length === 0) return candidates
  const enrolledRows = await db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, targetCourseId),
        isNull(enrollments.deletedAt),
        inArray(
          enrollments.studentId,
          candidates.map((candidate) => candidate.studentId),
        ),
      ),
    )
  const enrolled = new Set(enrolledRows.map((row) => row.studentId))
  return candidates.map((candidate) => ({
    ...candidate,
    alreadyEnrolledInTarget: enrolled.has(candidate.studentId),
  }))
}

async function resolveRule(rulePublicId: string) {
  const rows = await db
    .select()
    .from(enrollmentRules)
    .where(and(eq(enrollmentRules.publicId, rulePublicId), isNull(enrollmentRules.deletedAt)))
    .limit(1)
  const rule = rows.at(0)
  if (!rule) throw new Error('RULE_NOT_FOUND')
  return rule
}

function publicTriggerLabel(
  trigger: { triggerKind: RuleTrigger; triggerTag: string | null },
  triggerCourseTitle: string | null,
): string {
  switch (trigger.triggerKind) {
    case 'course_completed':
      return `${triggerCourseTitle ?? 'Unknown course'} completed`
    case 'tag_added':
      return `Tag = ${trigger.triggerTag ?? ''}`
    case 'cohort_assigned':
      return 'Assigned to cohort'
    case 'account_created':
      return 'Account created'
  }
}

export async function getRulesImpl(): Promise<{ items: EnrollmentRuleRow[] }> {
  await requireStudentReadRole()

  const ruleRows = await db
    .select({
      id: enrollmentRules.id,
      publicId: enrollmentRules.publicId,
      name: enrollmentRules.name,
      triggerKind: sql<string>`${enrollmentRules.triggerKind}::text`,
      triggerTag: enrollmentRules.triggerTag,
      triggerCourseId: enrollmentRules.triggerCourseId,
      targetCourseId: enrollmentRules.targetCourseId,
      minQuizAvgPercent: enrollmentRules.minQuizAvgPercent,
      sendWelcomeEmail: enrollmentRules.sendWelcomeEmail,
      status: sql<string>`${enrollmentRules.status}::text`,
      lastRunAt: enrollmentRules.lastRunAt,
    })
    .from(enrollmentRules)
    .where(isNull(enrollmentRules.deletedAt))
    .orderBy(desc(enrollmentRules.createdAt))
    .limit(100)

  if (ruleRows.length === 0) return { items: [] }

  // Resolve trigger/target course titles and the latest run per rule.
  const courseIds = Array.from(
    new Set(
      ruleRows.flatMap((row) =>
        [row.triggerCourseId, row.targetCourseId].filter((id): id is number => id != null),
      ),
    ),
  )
  const courseRows = await db
    .select({ id: courses.id, publicId: courses.publicId, title: courses.title })
    .from(courses)
    .where(inArray(courses.id, courseIds))
  const courseById = new Map(courseRows.map((row) => [row.id, row]))

  const runRows = await db
    .select({
      ruleId: enrollmentRuleRuns.ruleId,
      matched: enrollmentRuleRuns.matched,
      enrolled: enrollmentRuleRuns.enrolled,
      skipped: enrollmentRuleRuns.skipped,
      failed: enrollmentRuleRuns.failed,
      ranAt: enrollmentRuleRuns.ranAt,
    })
    .from(enrollmentRuleRuns)
    .where(
      inArray(
        enrollmentRuleRuns.ruleId,
        ruleRows.map((row) => row.id),
      ),
    )
    .orderBy(desc(enrollmentRuleRuns.ranAt))
  const lastRunByRule = new Map<number, (typeof runRows)[number]>()
  for (const run of runRows) {
    if (!lastRunByRule.has(run.ruleId)) lastRunByRule.set(run.ruleId, run)
  }

  return {
    items: ruleRows.map((row) => {
      const lastRun = lastRunByRule.get(row.id)
      const target = courseById.get(row.targetCourseId)
      const trigger = courseById.get(row.triggerCourseId ?? -1)
      return {
        publicId: row.publicId,
        name: row.name,
        triggerKind: row.triggerKind as EnrollmentRuleRow['triggerKind'],
        triggerLabel: publicTriggerLabel(
          { triggerKind: row.triggerKind as RuleTrigger, triggerTag: row.triggerTag },
          trigger?.title ?? null,
        ),
        targetCoursePublicId: target?.publicId ?? '',
        targetCourseTitle: target?.title ?? 'Unknown course',
        minQuizAvgPercent: row.minQuizAvgPercent,
        sendWelcomeEmail: row.sendWelcomeEmail,
        status: row.status as EnrollmentRuleRow['status'],
        lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
        lastRunSummary:
          lastRun == null
            ? null
            : {
                matched: Number(lastRun.matched),
                enrolled: Number(lastRun.enrolled),
                skipped: Number(lastRun.skipped),
                failed: Number(lastRun.failed),
              },
      }
    }),
  }
}

async function writeRule(input: RuleSaveInput, staffId: string): Promise<{ publicId: string }> {
  const target = await db
    .select({ id: courses.id, publicId: courses.publicId })
    .from(courses)
    .where(and(eq(courses.publicId, input.targetCoursePublicId), isNull(courses.deletedAt)))
    .limit(1)
  const targetCourse = target.at(0)
  if (!targetCourse) throw new Error('COURSE_NOT_FOUND: target course not found')

  let triggerCourseId: number | null = null
  if (input.trigger.triggerKind === 'course_completed') {
    const rows = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.publicId, input.trigger.coursePublicId), isNull(courses.deletedAt)))
      .limit(1)
    triggerCourseId = rows.at(0)?.id ?? null
    if (triggerCourseId == null) throw new Error('COURSE_NOT_FOUND: trigger course not found')
  }
  let triggerCohortId: number | null = null
  if (input.trigger.triggerKind === 'cohort_assigned') {
    const { cohorts } = await import('@abugida/database/learning')
    const rows = await db
      .select({ id: cohorts.id })
      .from(cohorts)
      .where(and(eq(cohorts.publicId, input.trigger.cohortPublicId), isNull(cohorts.deletedAt)))
      .limit(1)
    triggerCohortId = rows.at(0)?.id ?? null
    if (triggerCohortId == null) throw new Error('COHORT_NOT_FOUND: trigger cohort not found')
  }

  // S-4.8 validation: no self-enrollment loops.
  validateRuleNotSelfLoop(
    input.trigger.triggerKind,
    input.trigger.triggerKind === 'course_completed' ? input.trigger.coursePublicId : null,
    input.targetCoursePublicId,
  )

  const values = {
    name: input.name,
    triggerKind: input.trigger.triggerKind,
    triggerCourseId,
    triggerTag: input.trigger.triggerKind === 'tag_added' ? input.trigger.tag.toLowerCase() : null,
    triggerCohortId,
    minQuizAvgPercent: input.minQuizAvgPercent,
    targetCourseId: targetCourse.id,
    sendWelcomeEmail: input.sendWelcomeEmail,
  }

  if (input.rulePublicId) {
    const existing = await resolveRule(input.rulePublicId)
    await db.update(enrollmentRules).set(values).where(eq(enrollmentRules.id, existing.id))
    return { publicId: existing.publicId }
  }

  const inserted = await db
    .insert(enrollmentRules)
    .values({ ...values, createdBy: staffId })
    .returning({ publicId: enrollmentRules.publicId })
  const row = inserted.at(0)
  if (!row) throw new Error('CREATE_FAILED')
  return { publicId: row.publicId }
}

export async function saveRuleImpl(input: RuleSaveInput): Promise<{ publicId: string }> {
  const staffId = await requireStudentWriteRole()
  return writeRule(input, staffId)
}

export async function setRuleStatusImpl(input: RuleStatusChangeInput): Promise<{ ok: true }> {
  await requireStudentWriteRole()
  const rule = await resolveRule(input.rulePublicId)
  await db
    .update(enrollmentRules)
    .set({ status: input.status })
    .where(eq(enrollmentRules.id, rule.id))
  return { ok: true }
}

export async function deleteRuleImpl(input: { rulePublicId: string }): Promise<{ ok: true }> {
  await requireStudentWriteRole()
  const rule = await resolveRule(input.rulePublicId)
  await db.transaction(async (tx) => {
    await tx.delete(enrollmentRuleRuns).where(eq(enrollmentRuleRuns.ruleId, rule.id))
    await tx
      .update(enrollmentRules)
      .set({ deletedAt: new Date() })
      .where(eq(enrollmentRules.id, rule.id))
  })
  return { ok: true }
}

export async function duplicateRuleImpl(input: {
  rulePublicId: string
}): Promise<{ publicId: string }> {
  const staffId = await requireStudentWriteRole()
  const rule = await resolveRule(input.rulePublicId)
  const inserted = await db
    .insert(enrollmentRules)
    .values({
      name: `${rule.name} (copy)`,
      triggerKind: rule.triggerKind,
      triggerCourseId: rule.triggerCourseId,
      triggerTag: rule.triggerTag,
      triggerCohortId: rule.triggerCohortId,
      minQuizAvgPercent: rule.minQuizAvgPercent,
      targetCourseId: rule.targetCourseId,
      sendWelcomeEmail: rule.sendWelcomeEmail,
      status: 'draft',
      createdBy: staffId,
    })
    .returning({ publicId: enrollmentRules.publicId })
  const row = inserted.at(0)
  if (!row) throw new Error('DUPLICATE_FAILED')
  return { publicId: row.publicId }
}

/**
 * Dry-run (S-4.8): resolve matches without writing. Accepts either a saved
 * rule id or the unsaved editor draft.
 */
export async function dryRunRuleImpl(input: RuleDryRunInput): Promise<DryRunResult> {
  await requireStudentWriteRole()

  let spec: {
    triggerKind: RuleTrigger
    triggerCourseId: number | null
    triggerTag: string | null
    triggerCohortId: number | null
    targetCourseId: number
    minQuizAvgPercent: number | null
  }
  let targetCoursePublicId: string

  if (input.rulePublicId) {
    const rule = await resolveRule(input.rulePublicId)
    spec = {
      triggerKind: rule.triggerKind,
      triggerCourseId: rule.triggerCourseId,
      triggerTag: rule.triggerTag,
      triggerCohortId: rule.triggerCohortId,
      targetCourseId: rule.targetCourseId,
      minQuizAvgPercent: rule.minQuizAvgPercent,
    }
    targetCoursePublicId =
      (
        await db
          .select({ publicId: courses.publicId })
          .from(courses)
          .where(eq(courses.id, rule.targetCourseId))
          .limit(1)
      ).at(0)?.publicId ?? ''
  } else if (input.draft) {
    const draft = input.draft
    const target = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.publicId, draft.targetCoursePublicId), isNull(courses.deletedAt)))
      .limit(1)
    const targetCourse = target.at(0)
    if (!targetCourse) throw new Error('COURSE_NOT_FOUND: target course not found')
    let triggerCourseId: number | null = null
    if (draft.trigger.triggerKind === 'course_completed') {
      const rows = await db
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.publicId, draft.trigger.coursePublicId), isNull(courses.deletedAt)))
        .limit(1)
      triggerCourseId = rows.at(0)?.id ?? null
      if (triggerCourseId == null) throw new Error('COURSE_NOT_FOUND: trigger course not found')
    }
    let triggerCohortId: number | null = null
    if (draft.trigger.triggerKind === 'cohort_assigned') {
      const { cohorts } = await import('@abugida/database/learning')
      const rows = await db
        .select({ id: cohorts.id })
        .from(cohorts)
        .where(and(eq(cohorts.publicId, draft.trigger.cohortPublicId), isNull(cohorts.deletedAt)))
        .limit(1)
      triggerCohortId = rows.at(0)?.id ?? null
    }
    spec = {
      triggerKind: draft.trigger.triggerKind,
      triggerCourseId,
      triggerTag: draft.trigger.triggerKind === 'tag_added' ? draft.trigger.tag : null,
      triggerCohortId,
      targetCourseId: targetCourse.id,
      minQuizAvgPercent: draft.minQuizAvgPercent,
    }
    targetCoursePublicId = draft.targetCoursePublicId
    validateRuleNotSelfLoop(
      draft.trigger.triggerKind,
      draft.trigger.triggerKind === 'course_completed' ? draft.trigger.coursePublicId : null,
      targetCoursePublicId,
    )
  } else {
    throw new Error('VALIDATION_FAILED: a rule id or draft is required')
  }

  const candidates = await resolveCandidates(spec)
  const withState = await withEnrollmentState(candidates, spec.targetCourseId)

  const activeEnrollments = await countActiveEnrollments(spec.targetCourseId)
  const targetRows = await db
    .select({ capacity: courses.capacity })
    .from(courses)
    .where(eq(courses.id, spec.targetCourseId))
    .limit(1)
  const capacity = targetRows.at(0)?.capacity ?? null
  const capacityLeft = capacity == null ? null : Math.max(0, capacity - activeEnrollments)

  const outcome = evaluateRuleCandidates(
    { triggerKind: spec.triggerKind, minQuizAvgPercent: spec.minQuizAvgPercent },
    withState,
    capacityLeft,
  )
  const matched = outcome.willEnroll.length + outcome.willSkip.length

  return {
    matched,
    willEnroll: outcome.willEnroll.length,
    willSkip: outcome.willSkip.length,
    items: toDryRunItems(outcome),
    ...{ targetCoursePublicId },
  }
}

/**
 * Run a rule now (S-4.8 "Run"): enroll matched students in one transaction,
 * record the run log, notify new enrollees, and stamp lastRunAt.
 */
export async function runRuleImpl(input: RuleRunInput): Promise<RuleRunSummary> {
  const staffId = await requireStudentWriteRole()
  const rule = await resolveRule(input.rulePublicId)

  const spec = {
    triggerKind: rule.triggerKind,
    triggerCourseId: rule.triggerCourseId,
    triggerTag: rule.triggerTag,
    triggerCohortId: rule.triggerCohortId,
    targetCourseId: rule.targetCourseId,
    minQuizAvgPercent: rule.minQuizAvgPercent,
  }

  const candidates = await resolveCandidates(spec)
  const withState = await withEnrollmentState(candidates, rule.targetCourseId)

  const activeEnrollments = await countActiveEnrollments(rule.targetCourseId)
  const targetRows = await db
    .select({ capacity: courses.capacity, title: courses.title, publicId: courses.publicId })
    .from(courses)
    .where(eq(courses.id, rule.targetCourseId))
    .limit(1)
  const targetCourse = targetRows.at(0)
  const capacity = targetCourse?.capacity ?? null
  const capacityLeft = capacity == null ? null : Math.max(0, capacity - activeEnrollments)

  const outcome = evaluateRuleCandidates(
    { triggerKind: rule.triggerKind, minQuizAvgPercent: rule.minQuizAvgPercent },
    withState,
    capacityLeft,
  )

  let enrolled = 0
  const enrolledIds: string[] = []
  const failed = { count: 0 }
  await db.transaction(async (tx) => {
    for (const candidate of outcome.willEnroll) {
      try {
        await createEnrollmentInTx(tx, {
          studentId: candidate.studentId,
          courseId: rule.targetCourseId,
        })
        enrolled += 1
        enrolledIds.push(candidate.studentId)
      } catch {
        failed.count += 1
      }
    }
  })

  const details = [
    ...outcome.willEnroll.slice(0, 50).map((candidate) => ({
      name: candidate.studentName,
      outcome: 'enrolled',
      reason: 'matched rule',
    })),
    ...outcome.willSkip.slice(0, 50).map(({ candidate, reason }) => ({
      name: candidate.studentName,
      outcome: 'skipped',
      reason,
    })),
  ]

  await db.insert(enrollmentRuleRuns).values({
    ruleId: rule.id,
    runKind: 'manual',
    matched: outcome.willEnroll.length + outcome.willSkip.length,
    enrolled,
    skipped: outcome.willSkip.length,
    failed: failed.count,
    details,
    ranBy: staffId,
  })
  await db
    .update(enrollmentRules)
    .set({ lastRunAt: new Date() })
    .where(eq(enrollmentRules.id, rule.id))

  if (enrolledIds.length > 0 && targetCourse) {
    await createNotifications(enrolledIds, {
      type: 'enrollment',
      title: rule.sendWelcomeEmail
        ? 'Welcome! You were enrolled in a new course'
        : 'You were enrolled in a new course',
      body: targetCourse.title,
      linkEntityType: 'course',
      linkEntityPublicId: targetCourse.publicId,
    })
  }

  return {
    matched: outcome.willEnroll.length + outcome.willSkip.length,
    enrolled,
    skipped: outcome.willSkip.length,
    failed: failed.count,
  }
}

/** Run log (S-4.8): per-run matched/enrolled/skipped/failed + samples. */
export async function getRuleRunsImpl(query: RuleRunsQuery): Promise<{ items: RuleRunRow[] }> {
  await requireStudentReadRole()
  const rule = await resolveRule(query.rulePublicId)

  const rows = await db
    .select({
      publicId: enrollmentRuleRuns.publicId,
      runKind: sql<string>`${enrollmentRuleRuns.runKind}::text`,
      matched: enrollmentRuleRuns.matched,
      enrolled: enrollmentRuleRuns.enrolled,
      skipped: enrollmentRuleRuns.skipped,
      failed: enrollmentRuleRuns.failed,
      details: enrollmentRuleRuns.details,
      ranAt: enrollmentRuleRuns.ranAt,
    })
    .from(enrollmentRuleRuns)
    .where(eq(enrollmentRuleRuns.ruleId, rule.id))
    .orderBy(desc(enrollmentRuleRuns.ranAt))
    .limit(50)

  return {
    items: rows.map((row) => ({
      publicId: row.publicId,
      runKind: row.runKind as RuleRunRow['runKind'],
      matched: Number(row.matched),
      enrolled: Number(row.enrolled),
      skipped: Number(row.skipped),
      failed: Number(row.failed),
      ranAt: row.ranAt.toISOString(),
      details:
        (row.details as Array<{ name: string; outcome: string; reason: string }> | null) ?? null,
    })),
  }
}
