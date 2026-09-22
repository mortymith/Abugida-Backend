import { describe, expect, test } from 'bun:test'
import { toastDurationMs } from '#/components/common/toast'

/**
 * S-7.2 toast policy (spec 09): success auto-dismisses after 5s, info uses
 * the library default, warning and error require manual dismissal.
 */
describe('toastDurationMs', () => {
  test('success auto-dismisses after 5 seconds', () => {
    expect(toastDurationMs('success')).toBe(5000)
  })

  test('info uses the library default (4s)', () => {
    expect(toastDurationMs('info')).toBe(4000)
  })

  test('warning requires manual dismissal', () => {
    expect(toastDurationMs('warning')).toBe(Number.POSITIVE_INFINITY)
  })

  test('error requires manual dismissal', () => {
    expect(toastDurationMs('error')).toBe(Number.POSITIVE_INFINITY)
  })
})
