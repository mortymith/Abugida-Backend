/**
 * Route → human wording, shared by the live region and the document title.
 *
 * The breadcrumb trail already holds the right labels; what was missing was a
 * single place that decides how they are *read* and how they are *titled*. Two
 * consumers that each format independently drift: a screen reader hears one
 * string, the tab says another, and a user comparing them concludes one of them
 * is lying.
 *
 * Pure functions, so the wording is a contract test rather than something only
 * observable with a screen reader running.
 */

/** The document-title suffix — the product, not the organization. */
export const PRODUCT_NAME = 'Abugida Academy'

/**
 * What a screen reader hears on navigation: the trail, read as a path.
 *
 * `Courses / Course 3`, never `/courses/abc123`. Empty labels are dropped so a
 * crumb that failed to resolve contributes silence rather than a stray separator,
 * and the caller only announces on a real navigation — never on first render.
 */
export function composeAnnouncement(labels: readonly string[]): string {
  return labels
    .map((label) => label.trim())
    .filter(Boolean)
    .join(' / ')
}

/**
 * The document title: `Page · Courses · Abugida Academy`.
 *
 * The current page leads, so a window switcher or a bookmark list shows the most
 * specific thing first. The trail above it is capped at two segments — a deep
 * course workspace otherwise produces a title nobody can read in a tab strip —
 * and every segment is read in full, never truncated mid-word.
 */
export function buildDocumentTitle(labels: readonly string[]): string {
  const clean = labels.map((label) => label.trim()).filter(Boolean)
  const page = clean.at(-1)
  const trail = clean.slice(0, -1).slice(-2)

  return [...trail, page, PRODUCT_NAME].filter(Boolean).join(' · ')
}
