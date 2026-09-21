import { describe, expect, test } from 'bun:test'
import { parseLibrarySearch } from '#/features/library/schemas/library.schema'

/**
 * Regression cover for the `/content-library` search params.
 *
 * The route used a strict `z.enum` for `validateSearch`, so any URL carrying a
 * value outside the enum (`?type=all`, `?type=`, a repeated `?q=`, `?page=0`)
 * threw a raw Zod payload straight into the page. `parseLibrarySearch` must
 * narrow instead of throw.
 */
describe('parseLibrarySearch', () => {
  test('keeps valid values', () => {
    expect(parseLibrarySearch({ q: 'lecture', type: 'video', sort: 'size', page: '2' })).toEqual({
      q: 'lecture',
      folder: undefined,
      type: 'video',
      sort: 'size',
      page: 2,
    })
  })

  test('accepts a numeric page as a number', () => {
    expect(parseLibrarySearch({ page: 3 }).page).toBe(3)
  })

  test('drops an unrecognised type instead of throwing', () => {
    // The exact URL that used to render a Zod error page.
    expect(parseLibrarySearch({ type: 'all' })).toEqual({
      q: undefined,
      folder: undefined,
      type: undefined,
      sort: undefined,
      page: undefined,
    })
  })

  test.each([
    ['all', 'the filter-chip sentinel'],
    ['other', 'a category the chips do not offer'],
    ['undefined', 'a leaked JS undefined'],
    ['', 'an empty value'],
    ['VIDEO', 'a wrong-case value'],
  ])('drops type=%p (%s)', (value) => {
    expect(parseLibrarySearch({ type: value }).type).toBeUndefined()
  })

  test.each([
    ['all', 'a sentinel that is not a real sort'],
    ['title', 'a sort from the courses catalog'],
    ['', 'an empty value'],
  ])('drops sort=%p (%s)', (value) => {
    expect(parseLibrarySearch({ sort: value }).sort).toBeUndefined()
  })

  test.each([
    ['0', 'below the minimum'],
    ['-3', 'negative'],
    ['2.5', 'fractional'],
    ['abc', 'not a number'],
    ['', 'empty'],
  ])('drops page=%p (%s)', (value) => {
    expect(parseLibrarySearch({ page: value }).page).toBeUndefined()
  })

  test('drops a repeated or non-string q', () => {
    expect(parseLibrarySearch({ q: ['a', 'b'] }).q).toBeUndefined()
    expect(parseLibrarySearch({ q: 42 }).q).toBeUndefined()
  })

  test('caps q at the server-side limit', () => {
    expect(parseLibrarySearch({ q: 'x'.repeat(500) }).q).toHaveLength(100)
  })

  test.each([
    ['all', 'all folders'],
    ['root', 'uncategorized'],
  ])('keeps the folder sentinel %p', (value) => {
    expect(parseLibrarySearch({ folder: value }).folder).toBe(value)
  })

  test('keeps a folder public id', () => {
    const id = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
    expect(parseLibrarySearch({ folder: id }).folder).toBe(id)
  })

  test('drops a malformed folder id', () => {
    expect(parseLibrarySearch({ folder: 'not-a-uuid' }).folder).toBeUndefined()
  })

  test('never throws on hostile input', () => {
    const hostile = {
      q: { toString: () => 'boom' },
      type: Symbol('x'),
      sort: [],
      page: NaN,
      folder: {},
    }
    expect(() => parseLibrarySearch(hostile as unknown as Record<string, unknown>)).not.toThrow()
  })
})
