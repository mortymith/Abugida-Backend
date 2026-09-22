/**
 * Server-only implementation of S-5.5 Cohort Comparison Report: per-cohort
 * aggregates over cohort members' enrollments and quiz attempts, compared
 * side-by-side. Metric math delegates to the pure module.
 * Never import from client code.
 */
import { and, desc, eq, inArray, isNull, sql } from '@abugida/database'
import { cohortMembers, cohorts, enrollments, quizAttempts } from '@abugida/database/learning'
import { db } from '#/config/db.config'
import { buildCohortComparisonRows } from '../analytics.metric-math'
import type { CohortComparison, CohortComparisonColumn } from '../analytics.types'

/** Spec default: the two most recent cohorts are pre-selected. */
export const DEFAULT_COHORT_COUNT = 2
const MAX_COMPARE = 4

async function loadColumns(cohortPublicIds: string[]): Promise<CohortComparisonColumn[]> {
  if (cohortPublicIds.length === 0) return []

  const cohortRows = await db
    .select({ id: cohorts.id, publicId: cohorts.publicId, name: cohorts.name })
    .from(cohorts)
    .where(and(inArray(cohorts.publicId, cohortPublicIds), isNull(cohorts.deletedAt)))
  // Preserve the caller's order so the comparison reads left-to-right as chosen.
  const orderById = new Map(cohortRows.map((row) => [row.publicId, row]))
  const ordered = cohortPublicIds
    .map((publicId) => orderById.get(publicId))
    .filter((row): row is NonNullable<typeof row> => row != null)

  const columns: CohortComparisonColumn[] = []
  for (const cohort of ordered) {
    // LEFT JOIN keeps cohorts whose members have no enrollments on the radar
    // (member count still counts; the averages degrade to null).
    const statsRows = await db
      .select({
        memberCount: sql<number>`COUNT(DISTINCT ${cohortMembers.studentId})::int`,
        avgCompletionPct: sql<string | null>`AVG(${enrollments.progressPercentage})`,
        avgQuizScorePct: sql<string | null>`(
          SELECT AVG(qa.quiz_score_percentage)
          FROM ${quizAttempts} qa
          WHERE qa.student_id IN (SELECT cm2.student_id FROM ${cohortMembers} cm2 WHERE cm2.cohort_id = ${cohort.id})
        )`,
        avgWeeksToFinish: sql<string | null>`AVG(
          EXTRACT(EPOCH FROM (${enrollments.completedAt} - ${enrollments.createdAt})) / 604800.0
        )`,
      })
      .from(cohortMembers)
      .leftJoin(
        enrollments,
        and(eq(enrollments.studentId, cohortMembers.studentId), isNull(enrollments.deletedAt)),
      )
      .where(eq(cohortMembers.cohortId, cohort.id))
    const stats = statsRows.at(0)

    columns.push({
      cohortId: cohort.publicId,
      name: cohort.name,
      memberCount: stats?.memberCount ?? 0,
      avgCompletionPct:
        stats?.avgCompletionPct == null ? null : round2(Number(stats.avgCompletionPct)),
      avgQuizScorePct:
        stats?.avgQuizScorePct == null ? null : round2(Number(stats.avgQuizScorePct)),
      avgWeeksToFinish:
        stats?.avgWeeksToFinish == null ? null : round2(Number(stats.avgWeeksToFinish)),
    })
  }
  return columns
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Cohort comparison payload. With no explicit selection, defaults to the
 * two most recent cohorts (spec S-5.5 default state).
 */
export async function loadCohortComparison(cohortPublicIds: string[]): Promise<CohortComparison> {
  let selected = [...new Set(cohortPublicIds)].slice(0, MAX_COMPARE)

  if (selected.length === 0) {
    const recent = await db
      .select({ publicId: cohorts.publicId })
      .from(cohorts)
      .where(isNull(cohorts.deletedAt))
      .orderBy(desc(cohorts.createdAt))
      .limit(DEFAULT_COHORT_COUNT)
    selected = recent.map((row) => row.publicId)
  }

  const columns = await loadColumns(selected)
  return {
    columns,
    rows: buildCohortComparisonRows(columns),
    // Spec empty state: fewer than two cohorts exist to compare.
    isEmpty: columns.length < 2,
  }
}
