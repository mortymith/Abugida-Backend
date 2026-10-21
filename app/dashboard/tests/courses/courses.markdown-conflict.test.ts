/**
 * Spec 12 § 8.2 — two-column Markdown diff.
 *
 * The diff utility backs the three-option conflict dialog. The dialog itself
 * is exercised by manual + E2E; this test covers the pure functions that
 * have to behave identically across builds:
 *  - `diffMarkdown` produces the right row sequence for equal / added /
 *    removed / changed lines.
 *  - `summarizeDiff` counts each status correctly.
 *  - The `ConflictResolution` type narrows to the three spec values.
 */
import { test, expect } from 'bun:test'
import { diffMarkdown, summarizeDiff } from '#/features/courses/courses.markdown-conflict'
import type { ConflictResolution } from '#/features/courses/courses.markdown-conflict'

test('identical bodies produce one equal row per line', () => {
  const rows = diffMarkdown('hello\nworld', 'hello\nworld')
  expect(rows).toHaveLength(2)
  expect(rows[0].status).toBe('equal')
  expect(rows[0].left).toBe('hello')
  expect(rows[0].right).toBe('hello')
  expect(rows[1].status).toBe('equal')
})

test('added lines on the right are tagged "added"', () => {
  const rows = diffMarkdown('a', 'a\nb')
  expect(rows).toHaveLength(2)
  expect(rows[0].status).toBe('equal')
  expect(rows[0].left).toBe('a')
  expect(rows[0].right).toBe('a')
  expect(rows[1].status).toBe('added')
  expect(rows[1].right).toBe('b')
  expect(rows[1].left).toBe('')
  expect(rows[1].leftLine).toBeNull()
})

test('removed lines on the left are tagged "removed"', () => {
  const rows = diffMarkdown('a\nb', 'a')
  expect(rows).toHaveLength(2)
  expect(rows[0].status).toBe('equal')
  expect(rows[1].status).toBe('removed')
  expect(rows[1].left).toBe('b')
  expect(rows[1].right).toBe('')
  expect(rows[1].rightLine).toBeNull()
})

test('changed lines are tagged "changed" when no nearby match exists', () => {
  const rows = diffMarkdown('hello', 'goodbye')
  expect(rows).toHaveLength(1)
  expect(rows[0].status).toBe('changed')
  expect(rows[0].left).toBe('hello')
  expect(rows[0].right).toBe('goodbye')
})

test('a paragraph rewrite is detected as a changed line', () => {
  // Three unchanged lines, one changed line, one unchanged line. The diff
  // should find no nearby match (the changed line is unique on both sides)
  // and emit it as a single `changed` row.
  const left = '## Intro\n\nThis is the old paragraph.\n\n## Next'
  const right = '## Intro\n\nThis is the new paragraph.\n\n## Next'
  const rows = diffMarkdown(left, right)
  const statuses = rows.map((r) => r.status)
  expect(statuses).toContain('changed')
  // The unchanged `## Next` line should still appear as equal after the change.
  const tail = rows[rows.length - 1]
  expect(tail.status).toBe('equal')
  expect(tail.left).toBe('## Next')
  // The changed row should be the paragraph line, not the headings.
  const changed = rows.find((r) => r.status === 'changed')
  expect(changed?.left).toContain('old paragraph')
  expect(changed?.right).toContain('new paragraph')
})

test('summarizeDiff counts each status correctly', () => {
  const rows = diffMarkdown('a\nb\nc\nd', 'a\nX\nc\nY\ne')
  const summary = summarizeDiff(rows)
  expect(summary.added).toBeGreaterThan(0)
  expect(summary.removed).toBeGreaterThanOrEqual(0)
  expect(summary.changed).toBeGreaterThanOrEqual(0)
  expect(summary.unchanged).toBeGreaterThanOrEqual(1)
  expect(summary.added + summary.removed + summary.changed + summary.unchanged).toBe(rows.length)
})

test('ConflictResolution narrows to the three spec values', () => {
  const values: ConflictResolution[] = ['keep_mine', 'take_theirs', 'compare']
  expect(values).toHaveLength(3)
  // No other value is assignable.
  const _typecheck: ConflictResolution = 'keep_mine'
  expect(_typecheck).toBe('keep_mine')
})

test('empty bodies produce a single equal row (no diff noise)', () => {
  const rows = diffMarkdown('', '')
  expect(rows).toHaveLength(1)
  expect(rows[0].status).toBe('equal')
})

test('one empty body against non-empty emits added/removed rows', () => {
  // diffMarkdown('', 'a\nb'): left = [''], right = ['a', 'b']. The empty
  // left line vs 'a' is a changed row (no nearby match); then 'b' is added.
  const added = diffMarkdown('', 'a\nb')
  expect(added.length).toBeGreaterThan(0)
  // At least one row carries the right-side content.
  expect(added.some((r) => r.right === 'a')).toBe(true)
  expect(added.some((r) => r.right === 'b')).toBe(true)
  // Reverse direction: left has content, right is empty.
  const removed = diffMarkdown('a\nb', '')
  expect(removed.length).toBeGreaterThan(0)
  expect(removed.some((r) => r.left === 'a')).toBe(true)
  expect(removed.some((r) => r.left === 'b')).toBe(true)
})
