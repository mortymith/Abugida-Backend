/**
 * Shared custom matchers for `bun test`.
 *
 * Imported by `preload.ts`; kept in a separate module so test files that want
 * the matchers without the env defaults can import this module directly.
 */
import { expect } from 'bun:test'

interface CustomMatchers {
  /**
   * Asserts the received value is a number within [floor, ceiling]
   * (inclusive). Useful for timing, percentage, and aggregate assertions
   * where exact equality is meaningless.
   */
  toBeWithinRange(floor: number, ceiling: number): unknown
}

declare module 'bun:test' {
  // Declaration merging into bun:test requires the interface form; bun's own
  // typings (`interface Matchers<T = unknown> extends MatchersBuiltin<T> {}`)
  // use the same empty-extends shape, and the generic parameter mirrors
  // bun:test's Matchers<T> signature even though these matchers do not use it.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars -- see comment above
  interface Matchers<T> extends CustomMatchers {}
}

expect.extend({
  toBeWithinRange(received: unknown, floor: number, ceiling: number) {
    const pass =
      typeof received === 'number' &&
      Number.isFinite(received) &&
      received >= floor &&
      received <= ceiling

    const hint = `expected ${String(received)} ${pass ? 'not ' : ''}to be within [${floor}, ${ceiling}]`
    return {
      pass,
      message: () => hint,
    }
  },
})
