/**
 * Two-column Markdown diff for the Lesson Editor conflict dialog — spec 12 § 8.2.
 *
 * The conflict surface matches the Row Conflict state in Part 04 S-2.7 exactly.
 * Revision 3 of spec 12 closes the destructive-only alternative by offering
 * three options:
 *   - **Keep mine** (default): re-fetch the server row, re-stamp
 *     `expectedRowVersion`, retry the save once, and log the override to the
 *     audit log.
 *   - **Take theirs**: discard the local buffer, hydrate the server body, clear
 *     the IndexedDB draft. This is the renamed Reload — destructive, so it is
 *     the last option and requires confirmation.
 *   - **Compare**: opens the two bodies side by side in a full-width overlay.
 *
 * The diff itself is a line-by-line comparison. We do not run a real diff
 * algorithm (Myers / patience) because:
 *   1. The dialog is read-only — there is no merge, so the only thing the
 *      author needs is to see *what changed*, not the minimal edit script.
 *   2. Prose diffs are dominated by paragraph rewrites; a line-level diff is
 *      readable, and the Compare overlay gives the author the full width to
 *      see it.
 *
 * What we do is compute, per line, whether it appears in both sides, in only
 * one, or in both with different content. The result is a list of rows the
 * dialog renders side-by-side with highlight classes.
 */

/** A row in the two-column diff. */
export interface DiffRow {
  /** 1-based line number in the author's body, or null when the line is only on the server side. */
  leftLine: number | null
  /** 1-based line number in the server's body, or null when the line is only on the author side. */
  rightLine: number | null
  /** Author's line content (empty string when the line is only on the server side). */
  left: string
  /** Server's line content (empty string when the line is only on the author side). */
  right: string
  /** Whether the row differs in any way (added, removed, or changed). */
  status: 'equal' | 'added' | 'removed' | 'changed'
}

/**
 * Compute a line-by-line two-column diff between two Markdown strings.
 *
 * The algorithm:
 *  1. Split both bodies on `\n` (CRLF already normalized to LF upstream).
 *  2. Walk both sides in lockstep while the lines are equal — that's the
 *     common prefix and the body of unchanged prose.
 *  3. When a mismatch is found, look ahead in both sides to find the next
 *     line that matches. Lines before the next match are emitted as
 *     `added` (only on the right), `removed` (only on the left), or `changed`
 *     (both sides have a line at the same position, but the content differs).
 *
 * This is O(N * M) worst case but the inputs are bounded at 200k characters,
 * so the worst case is on the order of a few thousand line-pairs, which is
 * fine for a dialog the author opens deliberately.
 */
export function diffMarkdown(left: string, right: string): DiffRow[] {
  const leftLines = left.split('\n')
  const rightLines = right.split('\n')
  const rows: DiffRow[] = []

  let leftIdx = 0
  let rightIdx = 0

  while (leftIdx < leftLines.length || rightIdx < rightLines.length) {
    const leftLine = leftLines[leftIdx]
    const rightLine = rightLines[rightIdx]

    if (leftIdx >= leftLines.length) {
      rows.push({
        leftLine: null,
        rightLine: rightIdx + 1,
        left: '',
        right: rightLine,
        status: 'added',
      })
      rightIdx += 1
      continue
    }
    if (rightIdx >= rightLines.length) {
      rows.push({
        leftLine: leftIdx + 1,
        rightLine: null,
        left: leftLine,
        right: '',
        status: 'removed',
      })
      leftIdx += 1
      continue
    }

    if (leftLine === rightLine) {
      rows.push({
        leftLine: leftIdx + 1,
        rightLine: rightIdx + 1,
        left: leftLine,
        right: rightLine,
        status: 'equal',
      })
      leftIdx += 1
      rightIdx += 1
      continue
    }

    // Look ahead in both directions for the next matching line. We search up
    // to a small window so a degenerate input doesn't blow up. The window is
    // large enough to absorb a typical paragraph rewrite (a few hundred
    // lines) and small enough that the worst case stays bounded.
    const WINDOW = 200
    let leftMatch = -1
    let rightMatch = -1
    for (let offset = 1; offset <= WINDOW; offset += 1) {
      if (leftIdx + offset < leftLines.length && leftLines[leftIdx + offset] === rightLine) {
        leftMatch = offset
        break
      }
      if (rightIdx + offset < rightLines.length && leftLine === rightLines[rightIdx + offset]) {
        rightMatch = offset
        break
      }
    }

    if (leftMatch > 0 && (rightMatch <= 0 || leftMatch <= rightMatch)) {
      // Lines only on the left (removed) before the match.
      for (let k = 0; k < leftMatch; k += 1) {
        rows.push({
          leftLine: leftIdx + 1,
          rightLine: null,
          left: leftLines[leftIdx],
          right: '',
          status: 'removed',
        })
        leftIdx += 1
      }
    } else if (rightMatch > 0) {
      // Lines only on the right (added) before the match.
      for (let k = 0; k < rightMatch; k += 1) {
        rows.push({
          leftLine: null,
          rightLine: rightIdx + 1,
          left: '',
          right: rightLines[rightIdx],
          status: 'added',
        })
        rightIdx += 1
      }
    } else {
      // No nearby match — emit as a changed pair.
      rows.push({
        leftLine: leftIdx + 1,
        rightLine: rightIdx + 1,
        left: leftLine,
        right: rightLine,
        status: 'changed',
      })
      leftIdx += 1
      rightIdx += 1
    }
  }

  return rows
}

/** Per-side counts the conflict dialog shows in its header. */
export interface DiffSummary {
  added: number
  removed: number
  changed: number
  unchanged: number
}

/** Summarise a diff for the dialog header ("+12 −4 ⌀3 changed"). */
export function summarizeDiff(rows: DiffRow[]): DiffSummary {
  const summary: DiffSummary = { added: 0, removed: 0, changed: 0, unchanged: 0 }
  for (const row of rows) {
    if (row.status === 'added') summary.added += 1
    else if (row.status === 'removed') summary.removed += 1
    else if (row.status === 'changed') summary.changed += 1
    else summary.unchanged += 1
  }
  return summary
}

/**
 * The author's resolution choice. Used by both the dialog (which emits it)
 * and the editor (which acts on it).
 *
 * The values are stable event names — spec 12 § 12.2 instrumentation uses
 * the same strings for the `lesson_editor_conflict_shown` event's
 * `resolution` property.
 */
export type ConflictResolution = 'keep_mine' | 'take_theirs' | 'compare'
