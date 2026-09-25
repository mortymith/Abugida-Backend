/**
 * Client-safe helpers for S-7.7 "Duplicate lesson to another course".
 *
 * The copy must land under a title that does not collide with anything already
 * in the target module, otherwise the unique `(module_id, sort_order)` ordering
 * and the lesson list become ambiguous. These helpers are pure so the naming
 * rules can be unit tested without a database.
 */

/** Suffix appended to a duplicated lesson's title. */
export const COPY_SUFFIX = ' (copy)'

/** Longest title the `lessons.title` column accepts. */
export const LESSON_TITLE_MAX = 300

function truncate(title: string): string {
  return title.slice(0, LESSON_TITLE_MAX)
}

/** Matches a trailing " (copy)" or " (copy 3)" produced by a previous duplicate. */
const COPY_SUFFIX_PATTERN = /\s*\(copy(?:\s+\d+)?\)\s*$/i

/**
 * Produces a copy title that is not already present in `takenTitles`.
 *
 * - first duplicate  → `Title (copy)`
 * - second duplicate → `Title (copy 2)`
 * - third            → `Title (copy 3)`
 *
 * Any copy suffix already on the source title is stripped first, so duplicating
 * a copy yields `Title (copy 2)` rather than `Title (copy) (copy 2)`. The
 * result always fits the 300-char `lessons.title` column.
 */
export function resolveCopyTitle(sourceTitle: string, takenTitles: readonly string[]): string {
  // Strip a trailing copy suffix (and any padding) before re-deriving one.
  const stem = sourceTitle.trim().replace(COPY_SUFFIX_PATTERN, '').trim()

  // Reserve room for the longest " (copy N)" suffix so the result always fits.
  const room = LESSON_TITLE_MAX - COPY_SUFFIX.length - 4
  const base = stem.slice(0, room)

  const taken = new Set(takenTitles.map((title) => title.trim().toLowerCase()))
  const first = `${base}${COPY_SUFFIX}`
  if (!taken.has(first.toLowerCase())) return first

  for (let attempt = 2; attempt < 500; attempt += 1) {
    const suffix = ` (copy ${attempt})`
    const candidate = `${base.slice(0, LESSON_TITLE_MAX - suffix.length)}${suffix}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }

  return truncate(`${base} (copy ${Date.now().toString(36)})`)
}
