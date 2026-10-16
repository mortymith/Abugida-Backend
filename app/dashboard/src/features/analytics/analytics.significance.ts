/**
 * S-5.5 Significance testing + not-like-for-like coverage (spec 07 § S-5.5).
 *
 * The spec: "Each ▲/▼ delta carries a significance statement — a two-
 * proportion comparison at 95% — or, where the difference does not clear
 * it, the explicit text 'difference not meaningful at this sample size'
 * and no arrow. A comparison across cohorts that do not cover the same
 * set of courses says so above the table and marks the affected rows."
 */

export interface SignificanceResult {
  readonly significant: boolean
  readonly zScore: number
  readonly confidenceLevel: number
  readonly label: string
}

/**
 * Two-proportion z-test at 95% confidence. Returns whether the difference
 * between `p1` (from `n1` samples) and `p2` (from `n2` samples) is
 * statistically significant.
 *
 * The z-score is computed as:
 *   z = (p1 - p2) / sqrt(p_pool * (1 - p_pool) * (1/n1 + 1/n2))
 * where p_pool = (x1 + x2) / (n1 + n2).
 *
 * At 95% confidence, the critical z is ±1.96. If |z| > 1.96, the
 * difference is significant.
 */
export function twoProportionZTest(
  p1: number,
  n1: number,
  p2: number,
  n2: number,
): SignificanceResult {
  // Guard against insufficient sample size.
  if (n1 < 5 || n2 < 5) {
    return {
      significant: false,
      zScore: 0,
      confidenceLevel: 0.95,
      label: 'difference not meaningful at this sample size',
    }
  }

  const x1 = p1 * n1
  const x2 = p2 * n2
  const pPool = (x1 + x2) / (n1 + n2)

  // Guard against zero variance (both proportions identical or both 0/1).
  if (pPool === 0 || pPool === 1) {
    return {
      significant: false,
      zScore: 0,
      confidenceLevel: 0.95,
      label: p1 === p2 ? 'no difference' : 'difference not meaningful at this sample size',
    }
  }

  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2))
  const z = se === 0 ? 0 : (p1 - p2) / se
  const significant = Math.abs(z) > 1.96

  return {
    significant,
    zScore: Math.round(z * 1000) / 1000,
    confidenceLevel: 0.95,
    label: significant ? 'significant' : 'difference not meaningful at this sample size',
  }
}

/**
 * The delta label for a cohort comparison cell. Returns the arrow +
 * magnitude when significant, or the "not meaningful" text when not.
 *
 * The spec: "no ▲/▼ delta is rendered without either a significance
 * statement or the explicit 'difference not meaningful at this sample
 * size'."
 */
export function deltaLabel(
  value1: number,
  value2: number,
  significance: SignificanceResult,
  unit: 'pts' | '%' | 'weeks',
): string {
  if (!significance.significant) {
    return significance.label
  }
  const diff = value2 - value1
  const sign = diff > 0 ? '▲ +' : '▼ '
  const rounded = Math.round(diff * 10) / 10
  return `${sign}${rounded} ${unit}`
}

// ── Not-like-for-like coverage ─────────────────────────────────────────────

export interface CohortCoverage {
  readonly cohortId: string
  readonly cohortName: string
  readonly courseIds: ReadonlySet<string>
}

export interface CoverageMismatch {
  readonly mismatched: boolean
  readonly differingCourseIds: readonly string[]
  readonly warning: string | null
}

/**
 * Detect whether cohorts in a comparison cover different courses. The
 * spec: "A comparison across cohorts that do not cover the same set of
 * courses says so above the table and marks the affected rows, because
 * comparing an intro course against a full track measures the
 * curriculum, not the cohort."
 */
export function detectCoverageMismatch(cohorts: readonly CohortCoverage[]): CoverageMismatch {
  if (cohorts.length < 2) {
    return { mismatched: false, differingCourseIds: [], warning: null }
  }

  // Compute the union of all cohort course sets.
  const allCourseIds = new Set<string>()
  for (const cohort of cohorts) {
    for (const id of cohort.courseIds) allCourseIds.add(id)
  }

  // Find courses that are in some cohorts but not all.
  const differingCourseIds: string[] = []
  for (const courseId of allCourseIds) {
    const inAll = cohorts.every((c) => c.courseIds.has(courseId))
    if (!inAll) differingCourseIds.push(courseId)
  }

  if (differingCourseIds.length === 0) {
    return { mismatched: false, differingCourseIds: [], warning: null }
  }

  const cohortNames = cohorts.map((c) => c.cohortName)
  const warning = `${cohortNames.join(' and ')} cover different courses — the comparison is not like-for-like.`

  return { mismatched: true, differingCourseIds, warning }
}

/**
 * Whether a cohort should be excluded from deltas. The spec: "A cohort
 * with fewer than `MIN_SAMPLE_SIZE = 5` students can be added, but its
 * column renders `—` and is excluded from every delta."
 */
export function shouldExcludeCohortFromDeltas(memberCount: number): boolean {
  return memberCount < 5
}
