import { describe, expect, test } from 'bun:test'
import {
  autoAdjustToPassing,
  computeContrastRatio,
  contrastLabel,
  contrastRejectionMessage,
  formatRejections,
  isContrastPassing,
  validateCustomCss,
} from '#/features/settings/settings.branding-validation'

describe('computeContrastRatio', () => {
  test('white on white = 1.0', () => expect(computeContrastRatio('#ffffff')).toBe(1.0))
  test('white on black > 20', () => expect(computeContrastRatio('#000000')).toBeGreaterThan(20))
  test('white on #7c3aed ~ 5.7', () => {
    const r = computeContrastRatio('#7c3aed')
    expect(r).toBeGreaterThan(5.0)
    expect(r).toBeLessThan(6.5)
  })
})
describe('isContrastPassing', () => {
  test('true at 4.5+', () => expect(isContrastPassing(5.0)).toBe(true))
  test('false below 4.5', () => expect(isContrastPassing(3.0)).toBe(false))
})
describe('contrastLabel', () => {
  test('includes ratio and ✔ for passing', () => {
    const label = contrastLabel('#7c3aed')
    expect(label).toContain('✔')
  })
  test('includes ✖ for failing', () => {
    const label = contrastLabel('#ffffff')
    expect(label).toContain('✖')
  })
})
describe('contrastRejectionMessage', () => {
  test('names the ratio + darker shade', () => {
    const msg = contrastRejectionMessage('#ffffff')
    expect(msg).toContain('pick a darker shade')
  })
})
describe('autoAdjustToPassing', () => {
  test('darkens until passing', () => {
    const adjusted = autoAdjustToPassing('#ffffff')
    expect(isContrastPassing(computeContrastRatio(adjusted))).toBe(true)
  })
})
describe('validateCustomCss', () => {
  test('valid custom properties pass', () => {
    const css = '--color-primary: #7c3aed;\n--color-radius: 8px;'
    const result = validateCustomCss(css)
    expect(result.valid).toBe(true)
    expect(result.rejections).toHaveLength(0)
  })
  test('rejects !important', () => {
    const css = '--color-primary: #7c3aed !important;'
    const result = validateCustomCss(css)
    expect(result.valid).toBe(false)
    expect(result.rejections[0].reason).toContain('!important')
  })
  test('rejects bare selectors', () => {
    const css = 'body { color: red; }'
    const result = validateCustomCss(css)
    expect(result.valid).toBe(false)
    expect(result.rejections[0].reason).toContain('bare selectors')
  })
  test('rejects with line number', () => {
    const css = '--color-primary: #7c3aed;\n!important'
    const result = validateCustomCss(css)
    expect(result.rejections[0].line).toBe(2)
  })
  test('comments are skipped', () => {
    const css = '/* comment */\n--color-primary: #7c3aed;'
    const result = validateCustomCss(css)
    expect(result.valid).toBe(true)
  })
})
describe('formatRejections', () => {
  test('formats line + reason', () => {
    const formatted = formatRejections([
      { line: 3, declaration: 'test', reason: '!important is not allowed' },
    ])
    expect(formatted[0]).toContain('line 3')
    expect(formatted[0]).toContain('!important')
  })
})
