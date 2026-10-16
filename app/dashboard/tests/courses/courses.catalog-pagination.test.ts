import { describe, expect, test } from 'bun:test'
import { COURSES_PAGE_SIZE } from '#/features/courses/schemas/courses.catalog.schema'
import { hasMoreCourses, nextCatalogPage } from '#/features/courses/courses.catalog-pagination'

/**
 * Regression coverage for the S-2.1 catalog grid.
 *
 * `page` used to be hard-coded to 0, so "Load more" prefetched a page the grid
 * could never render, and the sort dropdown appeared to do nothing whenever
 * the result set exceeded one page.
 */
describe('catalog pagination', () => {
  test('page size is the documented 24', () => {
    expect(COURSES_PAGE_SIZE).toBe(24)
  })

  test('reports more courses while the set is not exhausted', () => {
    expect(hasMoreCourses(24, 30)).toBe(true)
    expect(hasMoreCourses(0, 1)).toBe(true)
  })

  test('reports no more courses on a full or partial last page', () => {
    expect(hasMoreCourses(24, 24)).toBe(false)
    expect(hasMoreCourses(30, 30)).toBe(false)
    expect(hasMoreCourses(0, 0)).toBe(false)
  })

  test('advances one page at a time from the first page', () => {
    expect(nextCatalogPage(0, 24, 30)).toBe(1)
    expect(nextCatalogPage(1, 30, 30)).toBeUndefined()
  })

  test('never advances past the final page', () => {
    expect(nextCatalogPage(2, 30, 30)).toBeUndefined()
    expect(nextCatalogPage(0, 24, 24)).toBeUndefined()
  })

  test('a single page of results stops immediately', () => {
    expect(nextCatalogPage(0, 1, 1)).toBeUndefined()
    expect(nextCatalogPage(0, 2, 2)).toBeUndefined()
  })

  test('keeps requesting pages for a large catalog', () => {
    // 30 courses => page 0 has 24, page 1 has the remaining 6.
    let page = 0
    let loaded = 0
    const seen: number[] = []
    for (;;) {
      const size = Math.min(COURSES_PAGE_SIZE, 30 - loaded)
      loaded += size
      const next = nextCatalogPage(page, loaded, 30)
      if (next === undefined) break
      page = next
      seen.push(page)
    }
    expect(seen).toEqual([1])
    expect(loaded).toBe(30)
  })
})
