import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
  comparisonDelta,
  formatDelta,
  shortComparisonLabel,
  MIN_SAMPLE_SIZE,
} from '#/features/dashboard/dashboard.metric-math'
import { validateCustomRange } from '#/features/dashboard/schemas/dashboard.date-range.schema'

const NOW = new Date('2026-03-15T15:00:00Z')

/**
 * Spec S-1.1 / S-1.2 acceptance, expressed against the pure rules the screens
 * depend on: the `—`-not-`0%` contract, custom-range validation, and the
 * comparison label a card prints under its delta.
 */
describe('comparisonDelta', () => {
  test('renders a percentage when the comparison period has enough history', () => {
    expect(comparisonDelta({ current: 123, previous: 100, previousSample: 20 })).toBe(23)
  })

  test('renders null below the minimum sample size instead of a percentage', () => {
    expect(
      comparisonDelta({
        current: 123,
        previous: 100,
        previousSample: MIN_SAMPLE_SIZE - 1,
      }),
    ).toBeNull()
  })

  test('zero against zero is a measured 0%, not a missing delta', () => {
    expect(comparisonDelta({ current: 0, previous: 0, previousSample: 10 })).toBe(0)
  })

  test('growth from a zero base is not expressed as a percentage', () => {
    expect(comparisonDelta({ current: 50, previous: 0, previousSample: 0 })).toBeNull()
  })

  test('non-finite values never produce a delta', () => {
    expect(comparisonDelta({ current: Number.NaN, previous: 10, previousSample: 10 })).toBeNull()
  })
})

describe('formatDelta', () => {
  test('missing delta renders an em dash, not 0%', () => {
    expect(formatDelta(null)).toBe('—')
  })

  test('signs and rounding match the stat card', () => {
    expect(formatDelta(23.4)).toBe('+23%')
    expect(formatDelta(-4.55)).toBe('−4.6%')
    expect(formatDelta(0)).toBe('0%')
  })
})

describe('shortComparisonLabel', () => {
  test('names the window under the delta', () => {
    expect(shortComparisonLabel('previous 30 days')).toBe('vs prev 30 days')
    expect(shortComparisonLabel('previous 12 months')).toBe('vs prev 12 months')
  })
})

describe('validateCustomRange', () => {
  test('an empty pair is valid (no custom range selected)', () => {
    expect(validateCustomRange({ from: '', to: '' }, NOW)).toEqual({ ok: true })
  })

  test('end before start is rejected on the end field', () => {
    const result = validateCustomRange({ from: '2026-03-10', to: '2026-03-01' }, NOW)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.field).toBe('to')
  })

  test('a future end date is rejected', () => {
    const result = validateCustomRange({ from: '2026-03-01', to: '2026-03-20' }, NOW)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toBe("End date can't be in the future.")
  })

  test('a span over two years is rejected', () => {
    const result = validateCustomRange({ from: '2024-01-01', to: '2026-02-01' }, NOW)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toContain('2 years')
  })

  test('today as the end date is allowed', () => {
    expect(validateCustomRange({ from: '2026-03-01', to: '2026-03-15' }, NOW)).toEqual({ ok: true })
  })

  test('a half-filled pair asks for the missing endpoint', () => {
    const result = validateCustomRange({ from: '2026-03-01' }, NOW)
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.field).toBe('to')
  })
})

/**
 * Regression guard for the dashboard trend queries.
 *
 * In a drizzle `sql` template an interpolation becomes a **bound parameter**. So
 * `'${zone}'` is not "a quoted zone" — it is a parameter *inside* quotes, and the
 * database receives the literal text `'${zone}'` (rendered `'$1'`). Postgres
 * then rejects `AT TIME ZONE '$1'` as an unknown time zone, the query throws, and
 * the whole screen falls back to its retry state. Bind the value unquoted
 * (`AT TIME ZONE ${zone}`) instead.
 */
describe('server SQL never quotes a bound interpolation', () => {
  const appRoot = `${import.meta.dir}/..`
  const roots = ['src/features/dashboard/server', 'src/features/analytics/server']

  /** Every `sql` / `sql<...>` template body in a source file. */
  function sqlTemplates(source: string): string[] {
    return Array.from(source.matchAll(/sql(?:<[^>]*>)?`([\s\S]*?)`/g), (match) => match[1])
  }

  function serverFiles(): Array<{ path: string; source: string }> {
    return roots.flatMap((root) =>
      Array.from(new Bun.Glob('*.ts').scanSync(`${appRoot}/${root}`)).map((name) => ({
        path: `${root}/${name}`,
        source: readFileSync(`${appRoot}/${root}/${name}`, 'utf8'),
      })),
    )
  }

  test('no server module interpolates a value inside SQL quotes', () => {
    const offenders = serverFiles().flatMap(({ path, source }) =>
      sqlTemplates(source).flatMap((body, index) =>
        /'\$\{/.test(body) ? [`${path} (sql template #${index + 1})`] : [],
      ),
    )
    expect(offenders).toEqual([])
  })

  test('the scanner is not vacuous \u2014 it reads the module that had the bug', () => {
    const files = serverFiles()
    expect(files.map(({ path }) => path)).toContain(
      'src/features/dashboard/server/dashboard.overview.impl.server.ts',
    )
    const templates = sqlTemplates(
      files.find(
        ({ path }) => path === 'src/features/dashboard/server/dashboard.overview.impl.server.ts',
      )?.source ?? '',
    )
    expect(templates.some((body) => body.includes('AT TIME ZONE ${REPORTING_TIME_ZONE}'))).toBe(
      true,
    )
  })
})
