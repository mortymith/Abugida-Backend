import { describe, expect, test } from 'bun:test'
import {
  ANALYTICS_TIMEZONE,
  AT_RISK_DAYS,
  EXPORT_DIRECT_DOWNLOAD_THRESHOLD_BYTES,
  EXPORT_RETENTION_DAYS,
  FUNNEL_STEEP_DROP_PTS,
  isLowCorrect,
  isSteepDrop,
  isTooEasy,
  MAX_EXPORT_COURSES,
  MIN_INSIGHT_N,
  MIN_SAMPLE_SIZE,
  QUIZ_LOW_CORRECT_PCT,
  QUIZ_TOO_EASY_PCT,
  renderPercentage,
  renderPercentagePoints,
  shouldRenderInsight,
  shouldSuppress,
  SUPPRESSED_VALUE,
  SUPPRESSION_TOOLTIP,
  TOO_EASY_AMBIGUITY_NOTE,
} from '#/features/analytics/analytics.metric-dictionary'

describe('constants', () => {
  test('MIN_SAMPLE_SIZE is 5', () => expect(MIN_SAMPLE_SIZE).toBe(5))
  test('MIN_INSIGHT_N is 5', () => expect(MIN_INSIGHT_N).toBe(5))
  test('AT_RISK_DAYS is 14', () => expect(AT_RISK_DAYS).toBe(14))
  test('FUNNEL_STEEP_DROP_PTS is 20', () => expect(FUNNEL_STEEP_DROP_PTS).toBe(20))
  test('QUIZ_LOW_CORRECT_PCT is 50', () => expect(QUIZ_LOW_CORRECT_PCT).toBe(50))
  test('QUIZ_TOO_EASY_PCT is 95', () => expect(QUIZ_TOO_EASY_PCT).toBe(95))
  test('MAX_EXPORT_COURSES is 25', () => expect(MAX_EXPORT_COURSES).toBe(25))
  test('EXPORT threshold is 1 MB', () =>
    expect(EXPORT_DIRECT_DOWNLOAD_THRESHOLD_BYTES).toBe(1_048_576))
  test('EXPORT retention is 7 days', () => expect(EXPORT_RETENTION_DAYS).toBe(7))
  test('Timezone is Africa/Addis_Ababa', () =>
    expect(ANALYTICS_TIMEZONE).toBe('Africa/Addis_Ababa'))
  test('Suppressed value is —', () => expect(SUPPRESSED_VALUE).toBe('—'))
  test('Suppression tooltip', () => expect(SUPPRESSION_TOOLTIP).toContain('Not enough'))
  test('Too-easy note mentions ambiguity', () =>
    expect(TOO_EASY_AMBIGUITY_NOTE).toContain('ambiguous'))
})

describe('shouldSuppress', () => {
  test('true when denominator < 5', () => {
    expect(shouldSuppress(0)).toBe(true)
    expect(shouldSuppress(4)).toBe(true)
  })
  test('false when denominator >= 5', () => {
    expect(shouldSuppress(5)).toBe(false)
    expect(shouldSuppress(100)).toBe(false)
  })
})

describe('renderPercentage', () => {
  test('renders — when suppressed', () => {
    expect(renderPercentage(2, 3)).toBe(SUPPRESSED_VALUE)
  })
  test('renders 0% when denominator is 0 (measured, nobody succeeded)', () => {
    expect(renderPercentage(0, 10)).toBe('0%')
  })
  test('renders the percentage when not suppressed', () => {
    expect(renderPercentage(5, 10)).toBe('50%')
    expect(renderPercentage(7, 10)).toBe('70%')
  })
})

describe('renderPercentagePoints', () => {
  test('renders — when suppressed', () => {
    expect(renderPercentagePoints(20, 3)).toBe(SUPPRESSED_VALUE)
  })
  test('renders pts label', () => {
    expect(renderPercentagePoints(20, 100)).toBe('20 pts')
  })
})

describe('isSteepDrop', () => {
  test('true when decline > 20 pts', () => {
    expect(isSteepDrop(21)).toBe(true)
    expect(isSteepDrop(50)).toBe(true)
  })
  test('false when decline <= 20 pts', () => {
    expect(isSteepDrop(20)).toBe(false)
    expect(isSteepDrop(10)).toBe(false)
  })
})

describe('isLowCorrect', () => {
  test('true when correctPct < 50', () => {
    expect(isLowCorrect(49)).toBe(true)
    expect(isLowCorrect(0)).toBe(true)
  })
  test('false when correctPct >= 50', () => {
    expect(isLowCorrect(50)).toBe(false)
    expect(isLowCorrect(100)).toBe(false)
  })
})

describe('isTooEasy', () => {
  test('true when correctPct >= 95', () => {
    expect(isTooEasy(95)).toBe(true)
    expect(isTooEasy(100)).toBe(true)
  })
  test('false when correctPct < 95', () => {
    expect(isTooEasy(94)).toBe(false)
    expect(isTooEasy(50)).toBe(false)
  })
})

describe('shouldRenderInsight', () => {
  test('true when n >= 5', () => {
    expect(shouldRenderInsight(5)).toBe(true)
    expect(shouldRenderInsight(100)).toBe(true)
  })
  test('false when n < 5', () => {
    expect(shouldRenderInsight(4)).toBe(false)
    expect(shouldRenderInsight(0)).toBe(false)
  })
})
