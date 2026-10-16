/**
 * Preview/test identity exclusion (spec 07 § Metric Definitions rule 1).
 *
 * The spec: "Preview and test identities are excluded from every
 * student-count metric and from the roster — not merely hidden in the
 * directory. Their progress events never enter a denominator."
 *
 * Two exclusion criteria:
 * 1. `users.is_test = true` — test/preview identities (M2 column).
 * 2. `enrollments.enrollment_source = 'preview'` — preview enrollments.
 *
 * This module provides the SQL fragment and the application-layer filter
 * so every analytics query applies the same exclusion consistently.
 */

/**
 * The SQL fragment that excludes preview/test identities. Applied to
 * every student-count query in the analytics server implementations.
 *
 * Usage in a drizzle query:
 * ```ts
 * .where(sql`${EXCLUDE_PREVIEW_AND_TEST_SQL(userAlias, enrollmentAlias)}`)
 * ```
 */
export function excludePreviewAndTestSql(
  userColumn: string = 'users.is_test',
  enrollmentSourceColumn: string = 'enrollments.enrollment_source',
): string {
  return `${userColumn} = false AND ${enrollmentSourceColumn} != 'preview'`
}

/**
 * Application-layer filter for preview/test exclusion. Used when filtering
 * in-memory (e.g. in pure-math modules that receive pre-fetched rows).
 */
export interface ExcludableRow {
  readonly isTest: boolean
  readonly enrollmentSource: string
}

/**
 * Whether a row should be excluded from analytics computations. Returns
 * `true` when the row is a preview/test identity.
 */
export function isPreviewOrTest(row: ExcludableRow): boolean {
  return row.isTest || row.enrollmentSource === 'preview'
}

/**
 * Filter an array of rows, excluding preview/test identities. Returns a
 * new array with only the real-student rows.
 */
export function excludePreviewAndTest<T extends ExcludableRow>(rows: readonly T[]): T[] {
  return rows.filter((row) => !isPreviewOrTest(row))
}

/**
 * Count the real (non-preview, non-test) students in a list. Used by
 * metric computations that need the denominator after exclusion.
 */
export function countRealStudents<T extends ExcludableRow>(rows: readonly T[]): number {
  return rows.filter((row) => !isPreviewOrTest(row)).length
}
