/**
 * Pure pagination rules for the S-2.1 course catalog grid.
 *
 * The grid used to hard-code `page: 0`, so sorting only ever applied to the
 * first page and "Load more" prefetched a page it could never render — which
 * made the sort dropdown look like it did nothing. These helpers keep the
 * "is there another page?" decision in one tested place.
 */

/** True when at least one more course remains beyond what is loaded. */
export function hasMoreCourses(loadedCount: number, totalCount: number): boolean {
  return loadedCount < totalCount
}

/**
 * The page index to fetch next, or `undefined` when the last page is reached.
 * `page` is the index of the page just loaded (0-based).
 */
export function nextCatalogPage(
  page: number,
  loadedCount: number,
  totalCount: number,
): number | undefined {
  return hasMoreCourses(loadedCount, totalCount) ? page + 1 : undefined
}
