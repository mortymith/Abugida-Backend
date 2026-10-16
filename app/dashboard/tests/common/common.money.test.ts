import { describe, expect, test } from 'bun:test'
import {
  formatMoney,
  formatMoneyWithUsd,
  isCurrencyCodeValid,
} from '#/components/common/common.money'

describe('formatMoney', () => {
  test('ETB with code visible', () => {
    const result = formatMoney(1240, 'ETB')
    expect(result).toContain('ETB')
    expect(result).toContain('1,240')
  })
  test('USD formatting', () => {
    const result = formatMoney(99, 'USD')
    expect(result).toContain('USD')
    expect(result).toContain('99')
  })
  test('two decimal places', () => {
    expect(formatMoney(5900, 'ETB')).toContain('5,900.00')
  })
})
describe('formatMoneyWithUsd', () => {
  test('includes USD equivalent in parentheses', () => {
    const result = formatMoneyWithUsd(5900, 'ETB', 99)
    expect(result).toContain('ETB')
    expect(result).toContain('USD')
    expect(result).toContain('(')
  })
  test('no USD parenthetical when currency is USD', () => {
    const result = formatMoneyWithUsd(99, 'USD', 99)
    expect(result).not.toContain('(')
  })
})
describe('isCurrencyCodeValid', () => {
  test('true for 3-letter code', () => expect(isCurrencyCodeValid('ETB')).toBe(true))
  test('true for lowercase', () => expect(isCurrencyCodeValid('usd')).toBe(true))
  test('false for 2-letter', () => expect(isCurrencyCodeValid('US')).toBe(false))
  test('false for 4-letter', () => expect(isCurrencyCodeValid('DOLL')).toBe(false))
})
