/**
 * Server binding for the auth event catalog (`auth.events.ts`).
 *
 * The catalog is pure; this is the half that talks to OpenTelemetry. The
 * contract with the catalog is deliberately narrow: names and attribute
 * domains are validated there, and this file only turns a validated series into
 * a counter increment.
 *
 * Two rules, both load-bearing:
 *
 *  1. **Instrumentation never fails a request.** Every call is wrapped. A
 *     broken exporter, an uninitialized provider, or a bad attribute must not
 *     be able to turn a successful sign-in into a 500 — the user already
 *     succeeded and the outcome must not change because a counter did.
 *  2. **Identifiers stay out of metrics.** They belong in `audit_logs` and
 *     `security_events`, which are per-account and queryable. A counter is a
 *     shape in aggregate; putting an id on one is unbounded cardinality. The
 *     catalog's sanitizer is the enforcement point.
 *
 * Never import from client code.
 */
import {
  createCounter,
  createHistogram,
  getMeter,
  incrementCounter,
  recordHistogram,
} from '#/config/observability.config'
import { AUTH_EVENTS, authSeriesKey, sanitizeAuthAttributes } from '../auth.events'
import type { AuthEventAttributes, AuthEventName } from '../auth.events'

const METER_NAME = '@abugida/dashboard/auth'

type Counter = ReturnType<typeof createCounter>
type Histogram = ReturnType<typeof createHistogram>

/** Memoized per series key, so a hot path allocates no instruments. */
const counters = new Map<string, Counter>()
const histograms = new Map<string, Histogram>()

/**
 * Spec S-0.4 measures "how many attempts did step 3 take" and S-0.4 action 5
 * reports "how many codes did regenerating invalidate". Both are distributions,
 * not labels, so they get a histogram rather than a bounded enum.
 */
export const AUTH_HISTOGRAMS = {
  /** Attempts to pass step 3, recorded when enrollment completes. */
  enrollmentStep3Attempts: 'auth.mfa_enrollment.step3_attempts',
  /** Backup codes invalidated by a regenerate. */
  backupCodesInvalidated: 'auth.mfa_backup_codes.invalidated',
} as const

export type AuthHistogramName = (typeof AUTH_HISTOGRAMS)[keyof typeof AUTH_HISTOGRAMS]

function counterFor(name: AuthEventName, key: string): Counter {
  const existing = counters.get(key)
  if (existing) return existing

  const created = createCounter(getMeter(METER_NAME), name, {
    description: `Abugida auth event: ${name}`,
    unit: '1',
  })
  counters.set(key, created)
  return created
}

function histogramFor(name: string, key: string): Histogram {
  const existing = histograms.get(key)
  if (existing) return existing

  const created = createHistogram(getMeter(METER_NAME), name, {
    description: `Abugida auth measurement: ${name}`,
    unit: '1',
  })
  histograms.set(key, created)
  return created
}

/**
 * Record one auth event.
 *
 * Attributes are sanitized against the catalog first, so an unlisted key or an
 * out-of-domain value is dropped rather than exported as a new series. The
 * return value reports whether the increment was actually emitted, which keeps
 * the function testable without an initialized provider.
 */
export function countAuthEvent(name: AuthEventName, attributes: AuthEventAttributes = {}): boolean {
  try {
    const clean = sanitizeAuthAttributes(name, attributes)
    const key = authSeriesKey(name, attributes)
    incrementCounter(counterFor(name, key), 1, clean)
    return true
  } catch {
    return false
  }
}

/** Record a numeric auth measurement (attempts, invalidated counts). */
export function recordAuthHistogram(name: AuthHistogramName, value: number): boolean {
  if (!Number.isFinite(value) || value < 0) return false

  try {
    recordHistogram(histogramFor(name, name), value)
    return true
  } catch {
    return false
  }
}

/**
 * Reset the memoized instruments.
 *
 * The OTel Meter caches instruments by name internally and re-registering the
 * same name is a no-op, so this exists for tests that assert on the memo map
 * rather than for correctness in production.
 */
export function resetAuthInstruments(): void {
  counters.clear()
  histograms.clear()
}

/** The series keys currently memoized — exported for tests. */
export function memoizedAuthSeries(): string[] {
  return [...counters.keys()]
}

export { AUTH_EVENTS }
