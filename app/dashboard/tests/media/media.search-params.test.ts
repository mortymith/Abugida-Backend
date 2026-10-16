import { describe, expect, test } from 'bun:test'
import { parseMediaSearch, trailFolderId } from '#/features/media/schemas/media.schema'

/**
 * Regression cover for the `/media` search params.
 *
 * The route used a strict `z.enum` for `validateSearch`, so any URL carrying a
 * value outside the enum (`?type=all`, `?type=`, a repeated `?q=`, `?page=0`)
 * threw a raw Zod payload straight into the page. `parseMediaSearch` must
 * narrow instead of throw.
 */
describe('parseMediaSearch', () => {
  test('keeps valid values', () => {
    expect(parseMediaSearch({ q: 'lecture', type: 'video', sort: 'size', page: '2' })).toEqual({
      q: 'lecture',
      folder: undefined,
      type: 'video',
      sort: 'size',
      page: 2,
    })
  })

  test('accepts a numeric page as a number', () => {
    expect(parseMediaSearch({ page: 3 }).page).toBe(3)
  })

  test('drops an unrecognised type instead of throwing', () => {
    // The exact URL that used to render a Zod error page.
    expect(parseMediaSearch({ type: 'all' })).toEqual({
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
    expect(parseMediaSearch({ type: value }).type).toBeUndefined()
  })

  test.each([
    ['all', 'a sentinel that is not a real sort'],
    ['title', 'a sort from the courses catalog'],
    ['', 'an empty value'],
  ])('drops sort=%p (%s)', (value) => {
    expect(parseMediaSearch({ sort: value }).sort).toBeUndefined()
  })

  test.each([
    ['0', 'below the minimum'],
    ['-3', 'negative'],
    ['2.5', 'fractional'],
    ['abc', 'not a number'],
    ['', 'empty'],
  ])('drops page=%p (%s)', (value) => {
    expect(parseMediaSearch({ page: value }).page).toBeUndefined()
  })

  test('drops a repeated or non-string q', () => {
    expect(parseMediaSearch({ q: ['a', 'b'] }).q).toBeUndefined()
    expect(parseMediaSearch({ q: 42 }).q).toBeUndefined()
  })

  test('caps q at the server-side limit', () => {
    expect(parseMediaSearch({ q: 'x'.repeat(500) }).q).toHaveLength(100)
  })

  test.each([
    ['all', 'all folders'],
    ['root', 'uncategorized'],
  ])('keeps the folder sentinel %p', (value) => {
    expect(parseMediaSearch({ folder: value }).folder).toBe(value)
  })

  test('keeps a folder public id', () => {
    const id = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
    expect(parseMediaSearch({ folder: id }).folder).toBe(id)
  })

  test('drops a malformed folder id', () => {
    expect(parseMediaSearch({ folder: 'not-a-uuid' }).folder).toBeUndefined()
  })

  test('never throws on hostile input', () => {
    const hostile = {
      q: { toString: () => 'boom' },
      type: Symbol('x'),
      sort: [],
      page: NaN,
      folder: {},
    }
    expect(() => parseMediaSearch(hostile as unknown as Record<string, unknown>)).not.toThrow()
  })
})

/**
 * `trailFolderId` guards the breadcrumb query. `all` and `root` are view
 * sentinels, not folder ids: `getFolderTrail` validates its input as a uuid, so
 * requesting a trail for them threw a Zod error on every "All folders" /
 * "Uncategorized" view (and React Query retried it three times).
 */
describe('trailFolderId', () => {
  test('returns the id for a real folder', () => {
    const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
    expect(trailFolderId(id)).toBe(id)
  })

  test('returns undefined for the view sentinels', () => {
    expect(trailFolderId('all')).toBeUndefined()
    expect(trailFolderId('root')).toBeUndefined()
  })

  test('returns undefined for missing or malformed values', () => {
    expect(trailFolderId(undefined)).toBeUndefined()
    expect(trailFolderId('')).toBeUndefined()
    expect(trailFolderId('not-a-uuid')).toBeUndefined()
    expect(trailFolderId('__none__')).toBeUndefined()
  })
})
