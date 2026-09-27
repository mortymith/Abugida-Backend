/**
 * "Save & Apply" return target for S-3.6 → its calling screen (spec S-3.6
 * Navigation: S-2.7 Lesson Editor or S-3.3 Asset Detail).
 *
 * The target travels through the URL (`?returnTo=…`), so it is untrusted input
 * and must never be handed to the router as-is: an open redirect would let a
 * crafted link bounce an author off-app the moment they apply captions. Only
 * the two documented calling screens are accepted, and only as an in-app
 * path. Anything else degrades to `undefined`, which makes the editor stay
 * put.
 */

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'

/** The only screens S-3.6 may return to (S-3.3 asset detail, S-2.7 lesson editor). */
export const LIBRARY_RETURN_PATTERNS: readonly RegExp[] = [
  // S-3.3 Asset Detail View
  new RegExp(`^/content-library/${UUID}$`),
  // S-2.7 Lesson Editor (and its course parent route)
  new RegExp(`^/courses/${UUID}$`),
  new RegExp(`^/courses/${UUID}/lessons/${UUID}$`),
]

/** True when the string contains an ASCII control character (never a legit path char). */
function hasControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code < 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * Normalizes a `returnTo` value to a safe in-app path, or `undefined` when it
 * is not one of the allowed calling screens.
 *
 * Rejects: absolute URLs (`https://…`), protocol-relative URLs (`//evil.com`),
 * backslash tricks (`/\evil.com`), `..` traversal, control characters,
 * non-string input, and any path outside the allow-list. A trailing `?query`
 * is preserved because the calling screen's own filters live there.
 */
export function parseLibraryReturnTo(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const raw = value.trim()
  if (raw === '' || raw.length > 500) return undefined
  // Must be a single-slash-rooted path: no scheme, no host, no backslash trick.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return undefined
  if (hasControlChars(raw)) return undefined

  const pathOnly = raw.split(/[?#]/)[0] ?? ''
  if (pathOnly.includes('..')) return undefined
  const normalizedPath = pathOnly.replace(/\/+$/, '')
  if (normalizedPath === '') return undefined
  if (!LIBRARY_RETURN_PATTERNS.some((pattern) => pattern.test(normalizedPath))) return undefined

  const search = raw.includes('?') ? `?${raw.slice(raw.indexOf('?') + 1)}` : ''
  return `${normalizedPath}${search}`
}
