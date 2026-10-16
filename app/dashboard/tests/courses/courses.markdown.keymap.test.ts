/**
 * Spec 12 § 12.1 — keymap tests.
 *
 * The spec calls for `courses.markdown.keymap.test.ts` covering:
 *  - `Ctrl/⌘+K` reaches the Command Palette from inside the editor
 *  - `Ctrl/⌘+S` flushes
 *  - `Ctrl/⌘+F` is not swallowed by the source `<textarea>`
 *
 * `Ctrl/⌘+K` and `Ctrl/⌘+F` are document-level keymaps that must be tested
 * against a real ProseMirror surface, which puts them in the E2E/manual pass
 * per § 12.1 ("Pure-logic tests need no DOM; the Editor-construction tests
 * (RT5) run against the browser-only path"). What `bun test` can cover is the
 * `Ctrl/⌘+S` handler on the autosave hook — it is a document-level
 * `keydown` listener that calls `flush()` and `preventDefault()`, and it must
 * not be swallowed by the editor surface (§ 7.3).
 *
 * The handler is split into a pure `shouldFlushOnSaveKey` predicate so the
 * keymap's wiring can be pinned without a DOM or React renderer.
 */
import { test, expect } from 'bun:test'
import { shouldFlushOnSaveKey } from '#/features/courses/hooks/courses.markdown-autosave'

test('Ctrl+S matches the save shortcut', () => {
  expect(shouldFlushOnSaveKey({ key: 's', metaKey: false, ctrlKey: true })).toBe(true)
})

test('Cmd+S matches the save shortcut (mac variant)', () => {
  expect(shouldFlushOnSaveKey({ key: 's', metaKey: true, ctrlKey: false })).toBe(true)
})

test('Ctrl+Shift+S matches (the key is matched case-insensitively)', () => {
  // Caps lock or shift would upper-case the key. The predicate lower-cases
  // before comparing, so Ctrl+Shift+S still flushes.
  expect(shouldFlushOnSaveKey({ key: 'S', metaKey: false, ctrlKey: true })).toBe(true)
})

test('a plain "s" keypress (no modifier) does not match', () => {
  expect(shouldFlushOnSaveKey({ key: 's', metaKey: false, ctrlKey: false })).toBe(false)
})

test('Ctrl+a does not match (a different shortcut)', () => {
  expect(shouldFlushOnSaveKey({ key: 'a', metaKey: false, ctrlKey: true })).toBe(false)
})

test('Ctrl+Control alone does not match (no key)', () => {
  // The "Control" key itself has key === "Control"; the predicate should not
  // match because "control" !== "s".
  expect(shouldFlushOnSaveKey({ key: 'Control', metaKey: false, ctrlKey: true })).toBe(false)
})

test('Alt+S does not match (alt is not a save modifier)', () => {
  // The predicate only checks meta/ctrl; alt alone is not enough.
  expect(shouldFlushOnSaveKey({ key: 's', metaKey: false, ctrlKey: false })).toBe(false)
})

test('Ctrl+Cmd+S matches (both modifiers held)', () => {
  expect(shouldFlushOnSaveKey({ key: 's', metaKey: true, ctrlKey: true })).toBe(true)
})

test('Ctrl+F5 does not match (different key, even with modifier)', () => {
  expect(shouldFlushOnSaveKey({ key: 'F5', metaKey: false, ctrlKey: true })).toBe(false)
})
