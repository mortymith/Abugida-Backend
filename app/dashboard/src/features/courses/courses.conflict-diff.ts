/**
 * Conflict resolution (spec 04 § Save Semantics → Conflict Resolution Flow,
 * spec 12 § 8.2 Concurrency).
 *
 * The spec is explicit about two hard invariants:
 *
 * 1. **No automatic Markdown merge.** Markdown is structural prose, not a
 *    line stream; an auto-merge would corrupt a Tiptap document. A conflict
 *    is always presented as a two-column diff and the author decides.
 *
 * 2. **"Reload-only" is banned everywhere in Part 04.** A conflict surface
 *    must always offer `Keep mine` (default) / `Take theirs` / `Compare`.
 *    `Take theirs` is the renamed Reload, but it is never the only option.
 *
 * This module is framework-free: it computes the diff and the action set;
 * the React component (`MarkdownConflictDiff`) renders them.
 */

export const CONFLICT_ACTIONS = ['keep-mine', 'take-theirs', 'compare'] as const

export type ConflictAction = (typeof CONFLICT_ACTIONS)[number]

export const CONFLICT_ACTION_LABELS: Record<ConflictAction, string> = {
  'keep-mine': 'Keep mine',
  'take-theirs': 'Take theirs',
  compare: 'Compare',
}

/**
 * Default action. The spec mandates `Keep mine` is the default — the
 * author's unsaved buffer is never silently replaced.
 */
export const DEFAULT_CONFLICT_ACTION: ConflictAction = 'keep-mine'

/**
 * A single line in a two-column diff. `type` distinguishes unchanged,
 * added, removed, and modified lines so the renderer can colour them
 * without re-parsing.
 */
export interface DiffLine {
  readonly type: 'unchanged' | 'added' | 'removed' | 'modified'
  readonly mine: string | null
  readonly theirs: string | null
  readonly lineNumber: number
}

/**
 * A computed two-column diff. `hasConflict` is true when at least one line
 * differs — a diff with no conflict is a no-op and the renderer should not
 * show the conflict surface at all.
 */
export interface ConflictDiff {
  readonly lines: readonly DiffLine[]
  readonly hasConflict: boolean
  readonly mineLines: number
  readonly theirsLines: number
}

/**
 * Compute a line-level diff between `mine` and `theirs`.
 *
 * This is a deliberately simple LCS-based diff — it produces the
 * `DiffLine[]` the renderer needs without pulling in a heavy dependency.
 * It is **not** a Markdown-aware merge: the spec forbids auto-merge, so a
 * structural diff is the correct granularity (line, not AST node).
 *
 * The algorithm:
 * 1. Split both bodies into lines.
 * 2. Compute the LCS table.
 * 3. Walk back to produce a sequence of `unchanged` / `added` / `removed`
 *    lines, where `added` and `removed` at the same position become
 *    `modified`.
 */
export function computeConflictDiff(mine: string, theirs: string): ConflictDiff {
  // Empty bodies produce no diff — an empty string has no lines to compare.
  if (mine === '' && theirs === '') {
    return { lines: [], hasConflict: false, mineLines: 0, theirsLines: 0 }
  }

  const mineLines = mine.split('\n')
  const theirsLines = theirs.split('\n')

  const m = mineLines.length
  const t = theirsLines.length

  // LCS table — (m+1) × (t+1). `lcs[i][j]` = length of LCS of
  // `mineLines[i..]` and `theirsLines[j..]`.
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(t + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = t - 1; j >= 0; j--) {
      if (mineLines[i] === theirsLines[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1])
      }
    }
  }

  // Walk forward to produce the diff.
  const lines: DiffLine[] = []
  let i = 0
  let j = 0
  let lineNumber = 0
  while (i < m && j < t) {
    if (mineLines[i] === theirsLines[j]) {
      lineNumber += 1
      lines.push({ type: 'unchanged', mine: mineLines[i], theirs: theirsLines[j], lineNumber })
      i += 1
      j += 1
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push({ type: 'removed', mine: mineLines[i], theirs: null, lineNumber })
      i += 1
    } else {
      lines.push({ type: 'added', mine: null, theirs: theirsLines[j], lineNumber })
      j += 1
    }
  }
  while (i < m) {
    lines.push({ type: 'removed', mine: mineLines[i], theirs: null, lineNumber })
    i += 1
  }
  while (j < t) {
    lines.push({ type: 'added', mine: null, theirs: theirsLines[j], lineNumber })
    j += 1
  }

  // Collapse adjacent `removed` + `added` into `modified`.
  const collapsed: DiffLine[] = []
  for (let k = 0; k < lines.length; k++) {
    const current = lines[k]
    const next = k + 1 < lines.length ? lines[k + 1] : null
    if (current.type === 'removed' && next !== null && next.type === 'added') {
      collapsed.push({
        type: 'modified',
        mine: current.mine,
        theirs: next.theirs,
        lineNumber: current.lineNumber,
      })
      k += 1
      continue
    }
    collapsed.push(current)
  }

  const hasConflict = collapsed.some((l) => l.type !== 'unchanged')

  return {
    lines: collapsed,
    hasConflict,
    mineLines: m,
    theirsLines: t,
  }
}

/**
 * Apply the chosen conflict action to produce the body that should be
 * persisted.
 *
 * - `keep-mine` → the author's buffer is kept; the server version is
 *   discarded. This is the default.
 * - `take-theirs` → the server version replaces the buffer. This is the
 *   renamed Reload, but it is never the only option.
 * - `compare` → returns `null`; the component opens the full-width Compare
 *   overlay and the author makes a follow-up choice.
 */
export function applyConflictAction(
  action: ConflictAction,
  mine: string,
  theirs: string,
): string | null {
  if (action === 'keep-mine') return mine
  if (action === 'take-theirs') return theirs
  return null
}

/**
 * Guard: a conflict surface must never be a Reload-only path. This helper
 * returns `true` when the given action set satisfies the spec — at least
 * `keep-mine` and `take-theirs` must be present, and `compare` must be
 * offered.
 *
 * Used by the test suite to pin the invariant; a component that drops
 * `keep-mine` would fail this check.
 */
export function isValidConflictActionSet(actions: readonly ConflictAction[]): boolean {
  return (
    actions.includes('keep-mine') && actions.includes('take-theirs') && actions.includes('compare')
  )
}
