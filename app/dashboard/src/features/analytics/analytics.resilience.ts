/**
 * Analytics resilience helpers (spec 07 § Resilience, spec 11 § Resilience
 * States).
 *
 * Every analytics screen ships 8 resilience states. This module owns the
 * per-screen resolvers that map analytics-specific conditions (per-panel
 * partial failure) to the universal resilience state machine.
 *
 * Key spec invariant for analytics: **per-panel partial failure** — one
 * panel failing to load does not block the others. "Item engagement
 * couldn't load. Summary is up to date."
 */

export const ANALYTICS_RESILIENCE_STATES = [
  'ok',
  'forbidden',
  'not_found',
  'offline',
  'reconnected',
  'session_expired',
  'conflict',
  'partial_failure',
  'server_error',
] as const

export type AnalyticsResilienceState = (typeof ANALYTICS_RESILIENCE_STATES)[number]

export interface AnalyticsResilienceConditions {
  readonly httpStatus: number | null
  readonly isOffline: boolean
  readonly wasOffline: boolean
  readonly sessionExpired: boolean
  readonly conflictDetected: boolean
  readonly partialFailure: boolean
  readonly hasData: boolean
}

export function resolveAnalyticsResilienceState(
  conditions: AnalyticsResilienceConditions,
): AnalyticsResilienceState {
  if (conditions.sessionExpired) return 'session_expired'
  if (conditions.isOffline) return 'offline'
  if (conditions.httpStatus === 403) return 'forbidden'
  if (conditions.httpStatus === 404) return 'not_found'
  if (conditions.conflictDetected) return 'conflict'
  if (conditions.partialFailure) return 'partial_failure'
  if (conditions.httpStatus !== null && conditions.httpStatus >= 500) return 'server_error'
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (conditions.wasOffline && !conditions.isOffline) return 'reconnected'
  return 'ok'
}

// ── Per-screen resolvers ───────────────────────────────────────────────────

export interface PerformanceConditions extends AnalyticsResilienceConditions {
  readonly summaryLoaded: boolean
  readonly itemEngagementLoaded: boolean
  readonly insightsLoaded: boolean
}

/**
 * S-5.1 Course Performance resolver. Per-panel partial failure: item
 * engagement, summary, and insights load independently; one failing
 * doesn't block the others.
 */
export function resolvePerformanceResilience(
  conditions: PerformanceConditions,
): AnalyticsResilienceState {
  // Per-panel partial failure is the defining case for S-5.1.
  if (conditions.summaryLoaded && !conditions.itemEngagementLoaded) {
    return 'partial_failure'
  }
  return resolveAnalyticsResilienceState(conditions)
}

export interface QuizConditions extends AnalyticsResilienceConditions {
  readonly summaryLoaded: boolean
  readonly distributionLoaded: boolean
}

/**
 * S-5.2 Quiz Analytics resolver. The answer distribution retries
 * independently of the summary line.
 */
export function resolveQuizResilience(conditions: QuizConditions): AnalyticsResilienceState {
  if (conditions.summaryLoaded && !conditions.distributionLoaded) {
    return 'partial_failure'
  }
  return resolveAnalyticsResilienceState(conditions)
}

export interface FunnelConditions extends AnalyticsResilienceConditions {
  readonly funnelLoaded: boolean
  readonly heatmapLoaded: boolean
}

/**
 * S-5.3 Drop-off Analysis resolver. The watch-time heatmap retries
 * independently of the funnel.
 */
export function resolveFunnelResilience(conditions: FunnelConditions): AnalyticsResilienceState {
  if (conditions.funnelLoaded && !conditions.heatmapLoaded) {
    return 'partial_failure'
  }
  return resolveAnalyticsResilienceState(conditions)
}

export interface ExportConditions extends AnalyticsResilienceConditions {
  readonly configFormOpen: boolean
}

/**
 * S-5.4 Export Reports resolver. Offline: Generate is disabled with
 * reason ("You're offline — exports need a connection"). The config form
 * stays open and readable.
 */
export function resolveExportResilience(conditions: ExportConditions): AnalyticsResilienceState {
  if (conditions.isOffline && conditions.configFormOpen) return 'offline'
  return resolveAnalyticsResilienceState(conditions)
}

export interface CohortComparisonConditions extends AnalyticsResilienceConditions {
  readonly cohortCount: number
  readonly loadedCohortCount: number
}

/**
 * S-5.5 Cohort Comparison resolver. A third cohort failing to load
 * leaves the two already-rendered columns usable.
 */
export function resolveCohortComparisonResilience(
  conditions: CohortComparisonConditions,
): AnalyticsResilienceState {
  if (conditions.cohortCount > conditions.loadedCohortCount && conditions.loadedCohortCount > 0) {
    return 'partial_failure'
  }
  return resolveAnalyticsResilienceState(conditions)
}

// ── Retry strategy ─────────────────────────────────────────────────────────

export type AnalyticsRetryStrategy = 'none' | 'auto' | 'manual'

export function analyticsRetryStrategy(state: AnalyticsResilienceState): AnalyticsRetryStrategy {
  if (state === 'offline') return 'auto'
  if (state === 'server_error') return 'auto'
  if (state === 'partial_failure') return 'manual'
  if (state === 'conflict') return 'manual'
  return 'none'
}

export function analyticsBackoffDelayMs(attempt: number): number {
  const base = 1000
  const max = 16_000
  return Math.min(base * 2 ** attempt, max)
}
