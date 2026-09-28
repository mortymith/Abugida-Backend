# Course Editor — Markdown Lesson Authoring (Tiptap)

> **Abugida Academy — Feature Specification** · Companion to Part 04 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Global Standards](11-Global-Standards.md) · [Courses →](04-Courses.md)

**Screen IDs covered:** `S-2.7` Lesson Editor (Markdown authoring surface), with supporting references to `S-2.3`, `S-2.6`, `S-2.13`, `S-2.14`, `S-2.16`, `S-3.6`, `S-7.1`, `S-7.2`.

**Status:** Approved for implementation. Every technical claim in [§3](#3-toolchain-constraint-analysis-markdown-support-in-tiptap-3313) and [Appendix A](#appendix-a--verification-procedure) was verified against the installed dependency tree, not inferred from documentation.

**Relationship to the UX specification:** [Part 04 § S-2.7](04-Courses.md#scr-2-7) remains the authoritative definition of the Lesson Editor's _layout, states, validation, and navigation_. This document does **not** restate or replace it. It specifies the **content model and editor implementation** behind the "Content Editor (Rich Text / Media Embed)" region of the S-2.7 wireframe, and the persistence contract that the rest of Section 2 depends on.

---

## 1. Goals & Non-Goals

### 1.1 Goals

| #   | Goal                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- |
| G-1 | Author lesson bodies as **Markdown**, with the installed Tiptap editor as the WYSIWYG surface.                                     |
| G-2 | Guarantee **round-trip stability**: `parse(serialize(doc)) === doc` for every construct the platform allows.                       |
| G-3 | Eliminate **silent content loss** — the failure mode where a construct parses to text and is destroyed on the next save.           |
| G-4 | Remain compatible with the **existing course management workflow**: review gate, row-version concurrency, autosave, library media. |
| G-5 | Keep the whole lesson body in a single source of truth (`lessons.body`) so no second column of copy can drift.                     |
| G-6 | Stay inside the existing architecture — no second editor, no second DB client, no cross-app imports.                               |

### 1.2 Non-Goals

- Not a redesign of the Lesson Editor layout (owned by S-2.7).
- Not collaborative/multi-user editing or CRDT merge — out of scope; the `rowVersion` guard remains the concurrency control.
- Not a general-purpose Markdown IDE. No file tree, no multi-file vault, no Git-style diffing.
- Not an AI authoring surface. The ✨ AI generators ([S-2.11](04-Courses.md#scr-2-11), [S-2.16](04-Courses.md#scr-2-16)) consume lesson text as _input_; making them emit Markdown is a separate spec.
- Not a replacement for [S-3.6](05-Content-Library.md#scr-3-6) transcription; the editor links to it, it does not embed it.

---

## 2. As-Built Inventory (verified)

The following is the current state of the code this spec modifies. It is recorded so reviewers can detect drift before implementing.

| Layer         | Location                                                     | Current behaviour                                                                                                  |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Route         | `src/routes/_app/courses/$courseId/lessons/$lessonId.tsx`    | Guards with `requireRolesBeforeLoad(['admin','editor'])`; composes `LessonEditor` + quiz modals.                   |
| Component     | `src/features/courses/components/courses.lesson-editor.tsx`  | 573 lines. `useEditor` with `StarterKit` + `LinkExtension` + `Placeholder`.                                        |
| Serialization | same                                                         | `editor.commands.setContent(body)` on load, `editor.getHTML()` on save. **HTML, not Markdown.**                    |
| Toolbar       | same (inline `ToolbarButton`)                                | 8 buttons, `window.prompt` for URLs, no menu/keyboard map, no `aria-pressed` grouping semantics beyond per-button. |
| Server fn     | `src/features/courses/server/courses.lessons.ts`             | `getLessonForEdit`, `saveLesson`, `submitLessonForReview` via `createServerFn`.                                    |
| Validation    | same — `saveLessonSchema`                                    | `body: z.string().max(200_000).nullable()`, `expectedRowVersion: z.number().int().positive()`.                     |
| Persistence   | `src/features/courses/server/courses.lessons.impl.server.ts` | Writes `lessons.body` verbatim. Optimistic concurrency via `rowVersion`.                                           |
| Storage       | `packages/database/src/schema/catalog/lessons.ts`            | `body: text('body')` — no format discriminator.                                                                    |
| Editor CSS    | `src/styles.css`                                             | **Contains no ProseMirror/Tiptap rules.** Styling is unstyled default ProseMirror today.                           |
| Tests         | `tests/courses.spec-04.test.ts`                              | Covers pure logic (curriculum tree, review state, pricing). No editor-serialization coverage.                      |

**Existing helper:** `stripMarkdown()` in `src/features/courses/courses.ai-local.ts` strips both HTML tags and Markdown syntax; it is a lossy text extractor for AI prompts and is **not** a serializer. It must not be reused for persistence.

---

## 3. Toolchain Constraint Analysis: Markdown Support in Tiptap 3.31.3

This is the section that determines the whole design. Each row was confirmed by inspecting the installed packages and by executing round-trip probes (see [Appendix A](#appendix-a--verification-procedure)).

### 3.1 The installed editor cannot emit Markdown out of the box

The dashboard installs Tiptap **3.31.3** (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`).

| Capability                                                     | Status at 3.31.3                                                                                                                                                                                                               | Consequence                                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `editor.getMarkdown()` / `editor.markdown`                     | **Absent.** Not on `Editor` without an extension.                                                                                                                                                                              | Cannot be used until a Markdown extension is added.                                    |
| `contentType: 'markdown'` on `EditorOptions`                   | **Absent.** Only declared by the `@tiptap/markdown` package's type augmentation.                                                                                                                                               | Same.                                                                                  |
| `@tiptap/pm/markdown` subpath                                  | **Does not exist.** `@tiptap/pm@3.31.3` exports only view/model/state/keymap/tables/history/commands/changeset/gapcursor/transform/dropcursor/inputrules/schema-list.                                                          | The commonly-cited import path is not available.                                       |
| `@tiptap/core` Markdown _authoring_ helpers                    | **Present** as the `markdown` namespace: `createBlockMarkdownSpec`, `createAtomBlockMarkdownSpec`, `createInlineMarkdownSpec`, `parseAttributes`, `serializeAttributes`, `parseIndentedBlocks`, `renderNestedMarkdownContent`. | These are for authoring **custom** node/mark specs. They are not a runtime serializer. |
| Base extension `parseMarkdown` / `renderMarkdown` handlers     | **Present** at runtime in `dist/index.js` of every content extension (heading, paragraph, bold, italic, strike, code, codeBlock, blockquote, lists, link, hardBreak, horizontalRule, underline, text).                         | StarterKit alone covers a wide Markdown subset.                                        |
| A runtime manager that walks the schema calling those handlers | **Absent** from `@tiptap/core`. Exists only in the separate `@tiptap/markdown` package as `MarkdownManager`.                                                                                                                   | The walk must come from that package.                                                  |

**Conclusion:** Markdown is reachable, but **not** through `@tiptap/pm/markdown` or a `getMarkdown()` that already exists. It requires adding the official, version-locked sibling package.

### 3.2 The official package is version-matched to what is installed

`@tiptap/markdown` is a first-party Tiptap package, not a third-party one.

| Property           | Value                                                                            |
| ------------------ | -------------------------------------------------------------------------------- |
| Latest version     | **3.31.3** — exactly the installed Tiptap version. No upgrade required.          |
| First published    | 3.7.0                                                                            |
| `peerDependencies` | `@tiptap/pm` `3.31.3`, `@tiptap/core` `3.31.3` — **exact pins**, satisfied today |
| `dependencies`     | `marked` `^17.0.1`                                                               |
| Export surface     | `Markdown` (the extension), `MarkdownManager`, markdown util helpers             |

The extension's own source shows precisely what it adds: it augments `Editor` with `getMarkdown()` and `markdown`, augments `EditorOptions` with `contentType`, and overrides `setContent` / `insertContent` / `insertContentAt` to route through `MarkdownManager.parse()` when `contentType: 'markdown'`.

### 3.3 Lossy-construct audit (the decisive finding)

Markdown parsed with **StarterKit only** is _silently destructive_ for three very common constructs. These are not errors — the content is quietly reduced and then overwritten on the next save.

| Construct                           | Markdown input                   | StarterKit-only output                       | Verdict        |
| ----------------------------------- | -------------------------------- | -------------------------------------------- | -------------- |
| Image                               | `![alt text](https://cdn/a.png)` | `alt text`                                   | **Data loss**  |
| Table                               | `\| a \| b \|` + delimiter + row | _(empty document)_                           | **Data loss**  |
| Task list                           | `- [x] done`                     | `- done`                                     | **Data loss**  |
| Autolink                            | `<https://example.com>`          | `[https://example.com](https://example.com)` | Cosmetic only  |
| Raw HTML block                      | `<div class="x">raw</div>`       | `&lt;div class="x"&gt;raw&lt;/div&gt;`       | Escaped, inert |
| Task-list checkbox in a nested list | `- [ ] parent` / `  - [x] child` | checkboxes stripped                          | **Data loss**  |

Every construct above is round-trip **stable** once the matching extension is registered. That is the difference between a stable and a lossy pipeline, and it is why [§4 D-2](#4-decisions) is mandatory rather than optional.

### 3.4 SSR hazard

`new Editor({ content, contentType: 'markdown' })` throws `there is no window object available` when the Markdown parses to an **empty** document (`''`, whitespace-only, or a construct with no registered handler such as an unregistered table). The `Markdown` extension deliberately leaves `options.content` as a raw string when `json.content` is empty, and ProseMirror's `DOMParser.parse` then requires `window`.

This runtime has no DOM (Bun), so the Lesson Editor **must never construct a Tiptap editor during SSR**. This is already the established pattern in `courses.lesson-editor.tsx` (`immediatelyRender: false`) and must be preserved — with the added rule that initial Markdown is applied on the client after mount.

`MarkdownManager.parse()` and `MarkdownManager.serialize()` are both **DOM-free** and safe to call on the server. This is what makes server-side validation and migration possible ([§9.3](#93-server-side-validation), [§5.3](#53-migration)).

### 3.5 Pre-existing defect to fix in passing

StarterKit 3.x **already bundles** `link` and `underline`. `courses.lesson-editor.tsx` additionally registers `LinkExtension`, producing a runtime warning:

```text
[tiptap warn]: Duplicate extension names found: ['link']. This can lead to issues.
```

Any Markdown work touches this extension list, so the duplicate must be removed and the options moved onto StarterKit:

```ts
StarterKit.configure({
  link: { openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } },
})
```

---

## 4. Decisions

| ID  | Decision                                                                                                                            | Rationale                                                                                                                                                                            | Status   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| D-1 | Add `@tiptap/markdown@3.31.3` as a direct dashboard dependency.                                                                     | Only version-matched, first-party Markdown runtime. Peer deps already satisfied. No Tiptap upgrade.                                                                                  | Accepted |
| D-2 | Also add `@tiptap/extension-image`, `-table`, `-table-row`, `-table-cell`, `-table-header`, `-task-list`, `-task-item` at `3.31.3`. | Without these, images/tables/task-lists are silently destroyed on save ([§3.3](#33-lossy-construct-audit-the-decisive-finding)). Images and checklists are core to lesson authoring. | Accepted |
| D-3 | Markdown is the **sole** persisted format. No dual HTML column.                                                                     | Dual formats guarantee drift. A single source of truth ([G-5](#11-goals)).                                                                                                           | Accepted |
| D-4 | Add a `body_format` discriminator to `lessons`; migrate existing rows.                                                              | Required to read legacy rows correctly. Sniffing for `<` is unreliable.                                                                                                              | Accepted |
| D-5 | Remove the duplicate `LinkExtension`; configure link through StarterKit.                                                            | Fixes [§3.5](#35-pre-existing-defect-to-fix-in-passing).                                                                                                                             | Accepted |
| D-6 | Register `Markdown` **last** in the extension array.                                                                                | It overrides `setContent`/`insertContent`; it must win command resolution.                                                                                                           | Accepted |
| D-7 | Migration runs **server-side** using `MarkdownManager.serialize()` over a constrained HTML→doc converter.                           | Legacy HTML was produced by a known, fixed schema; a constrained converter is safer than requiring every author to reopen every lesson.                                              | Accepted |
| D-8 | Editor is client-only (`immediatelyRender: false`).                                                                                 | [§3.4](#34-ssr-hazard).                                                                                                                                                              | Accepted |
| D-9 | Tiptap/ProseMirror base styles added to `src/styles.css`.                                                                           | Currently unstyled ([§2](#2-as-built-inventory-verified)); the Markdown split/preview surface depends on a predictable `.ProseMirror` box.                                           | Accepted |

**Rejected alternatives:**

- _Upgrade Tiptap to reach built-in Markdown_ — unnecessary. `@tiptap/markdown@3.31.3` is the current latest and matches the installed core exactly; an upgrade would touch every extension peer pin for no gain.
- _Third-party `tiptap-markdown`_ — last published at `0.9.0`, built for Tiptap 2.x. Unmaintained, incompatible.
- _Hand-rolled serializer using `@tiptap/core`'s `markdown` helpers_ — `MarkdownManager` already implements the schema walk, mark-rank ordering, and indentation logic. Reimplementing it would be strictly worse.
- _Store both `body_html` and `body_markdown`_ — see D-3.

---

## 5. Storage Model

### 5.1 Schema change

`lessons` gains one column in `packages/database/src/schema/catalog/lessons.ts`:

```ts
export const lessonBodyFormatEnum = z.enum(['html', 'markdown'])
export type LessonBodyFormat = z.infer<typeof lessonBodyFormatEnum>
export const lessonBodyFormatPgEnum = pgEnum('lesson_body_format', ['html', 'markdown'])

// inside pgTable('lessons', { … })
bodyFormat: lessonBodyFormatPgEnum().notNull().default('html'),
```

Following the file's existing conventions: the enum is declared next to `contentTypeEnum`/`lessonReviewStatusEnum`, exported through the same barrel, and omitted from `insertLessonSchema` (like `publicId` and `searchVector`) because it is set by the migration, not by callers.

**Default `'html'`** is deliberate: every existing row is HTML, and a new column defaulting to `markdown` would mis-declare all of them.

Then run, per the database runbook in [§12](#12-implementation-plan):

```bash
pnpm --filter @abugida/database db:generate
pnpm --filter @abugida/database db:migrate
```

### 5.2 Read path

`getLessonForEditImpl` normalises on read, so the client never sees a legacy format:

```ts
// courses.lessons.impl.server.ts
const bodyFormat = lesson.bodyFormat ?? 'html'
// Caller receives markdown only when the row has been migrated; otherwise the
// editor hydrates from HTML exactly as it does today.
```

`LessonEditDTO` gains:

```ts
body: string | null
bodyFormat: 'html' | 'markdown'
```

`LessonEditor` hydrates with:

```ts
if (data.bodyFormat === 'markdown') {
  editor.commands.setContent(data.body ?? '', { contentType: 'markdown' })
} else {
  editor.commands.setContent(data.body ?? '') // legacy HTML
}
```

This makes rollout incremental and reversible: a lesson is Markdown-native the moment its row is migrated, and untouched lessons keep working.

### 5.3 Migration

Migration is a one-shot script that is **safe to re-run** and **idempotent per row**.

1. Select lessons where `body_format = 'html'` and (`body` is not null and `body <> ''`).
2. Convert HTML → ProseMirror doc JSON.
3. `MarkdownManager.serialize(doc)` → Markdown.
4. **Verify** the result re-parses to an equivalent doc (see [§10.2](#102-round-trip-invariants)). If not, leave the row as HTML and record it.
5. `UPDATE lessons SET body = <md>, body_format = 'markdown' WHERE id = … AND row_version = …` (optimistic, matching the app's concurrency model).

**Why the HTML→doc step cannot use Tiptap's own parser:** `generateJSON()` / `createNodeFromContent()` route through `elementFromString()`, which throws without a DOM ([§3.4](#34-ssr-hazard)). The legacy HTML was emitted by `editor.getHTML()` from a fixed schema (StarterKit + link), so the supported subset is closed and small:

| Legacy tag               | Convert to                                  |
| ------------------------ | ------------------------------------------- |
| `<p>`                    | `paragraph`                                 |
| `<h2>`–`<h6>`,`<h1>`     | `heading` with matching `level`             |
| `<strong>`,`<b>`         | `bold` mark                                 |
| `<em>`,`<i>`             | `italic` mark                               |
| `<s>`,`<strike>`,`<del>` | `strike` mark                               |
| `<code>`                 | `code` mark                                 |
| `<pre><code>`            | `codeBlock`                                 |
| `<a href>`               | `link` mark with `href`                     |
| `<ul>`,`<ol>`,`<li>`     | `bulletList`/`orderedList` + `listItem`     |
| `<blockquote>`           | `blockquote`                                |
| `<hr>`                   | `horizontalRule`                            |
| `<br>`                   | `hardBreak`                                 |
| anything else            | **Abort the row**, report it, leave as HTML |

The "abort the row" branch matters: an unknown tag means the stored HTML is not from the schema we expect, and guessing would risk silent loss. Those rows stay HTML and are surfaced in the migration report for manual handling.

Place the converter in `src/features/courses/courses.legacy-html.ts` — pure, client-safe, no DOM, directly unit-testable with `bun test`, consistent with `courses.import-rows.ts` being pure and testable.

**Migration report** (mirrors the run-report language already used by S-2.13 [Bulk Import](04-Courses.md#scr-2-13)):

```text
lessons scanned: 1,284 · migrated: 1,201 · already markdown: 60 · skipped (empty): 19
skipped (unconvertible): 4
  - 7f3c… "Advanced Tonal Patterns"  — unexpected <figure> at offset 812
  - …
```

### 5.4 Write path

`saveLesson` writes Markdown and stamps the discriminator:

```ts
await db
  .update(lessons)
  .set({ body: input.body, bodyFormat: 'markdown', rowVersion: sql`${lessons.rowVersion} + 1` })
  .where(and(eq(lessons.id, lessonId), eq(lessons.rowVersion, input.expectedRowVersion)))
```

`saveLessonSchema` gains a hard rule that enforces [G-2](#11-goals) at the boundary:

```ts
body: z.string().max(200_000).nullable(),
bodyFormat: z.literal('markdown'),
```

Rejecting anything but `'markdown'` means a client that forgets to call `getMarkdown()` fails loudly at the boundary instead of writing HTML into a Markdown column.

---

## 6. Feature Module Layout

All paths relative to `app/dashboard/`. Naming follows the dot-separated convention ([AGENTS.md §5](../AGENTS.md)); routes stay thin; cross-feature imports go through barrels.

```text
src/features/courses/
├── courses.markdown.ts                 # NEW  pure: md <-> doc helpers, normalization, invariant checks
├── courses.legacy-html.ts              # NEW  pure: legacy HTML -> ProseMirror doc (migration only)
├── courses.markdown.schema.ts          # NEW  Zod: body, bodyFormat, markdown limits
├── components/
│   ├── courses.lesson-editor.tsx       # EDIT orchestration: hydrate, autosave, save
│   ├── courses.markdown-editor.tsx     # NEW  the Tiptap instance + extension list (the only file that imports Tiptap)
│   ├── courses.markdown-toolbar.tsx    # NEW  toolbar, grouped by role, full a11y
│   ├── courses.markdown-source.tsx     # NEW  raw Markdown pane (editable)
│   ├── courses.markdown-preview.tsx    # NEW  rendered preview (streamdown)
│   └── courses.legacy-body-notice.tsx  # NEW  banner for not-yet-migrated lessons
├── hooks/
│   ├── courses.markdown-autosave.ts    # NEW  60s autosave + Ctrl+S + dirty tracking
│   └── courses.markdown-views.ts       # NEW  view-mode state (rich | split | source)
├── server/
│   ├── courses.lessons.ts              # EDIT schema + server fns
│   ├── courses.lessons.impl.server.ts  # EDIT read/write + bodyFormat
│   └── courses.markdown-validate.impl.server.ts  # NEW  server-side MD lint (see §9.3)
└── index.ts                            # EDIT barrel additions
```

**Boundaries:**

- `courses.markdown-editor.tsx` is the **only** module that imports `@tiptap/react` / `@tiptap/starter-kit` / `@tiptap/markdown`. The extension list lives in exactly one place, so the D-6 ordering rule cannot be violated by a second call site.
- `courses.markdown.ts` and `courses.legacy-html.ts` are pure and client-safe, so `bun test` exercises them directly — the same pattern as `courses.import-rows.ts` and `courses.curriculum-tree.ts`.
- Server-only code stays in `server/` and is reached exclusively through `createServerFn` ([AGENTS.md §10](../AGENTS.md)).

### 6.1 The extension list

```ts
// courses.markdown-editor.tsx
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import Placeholder from '@tiptap/extension-placeholder'

export const LESSON_EDITOR_EXTENSIONS = [
  StarterKit.configure({
    link: { openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } },
  }),
  Image.configure({ allowBase64: false }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Placeholder.configure({ placeholder: 'Lesson content — rich text, media links…' }),
  Markdown, // D-6: must be last
] as const
```

Notes:

- `Image.configure({ allowBase64: false })` prevents pasted base64 blobs from reaching `lessons.body`. Images are served from the Content Library ([S-3.1](05-Content-Library.md#scr-3-1)); the existing "Add Media" affordance remains the supported path.
- `Table` imports as a **named** export (`import { Table } from '@tiptap/extension-table'`), not default.
- `Table` requires its row/header/cell siblings; omitting them throws `No node type or group 'tableRow' found`.
- `Markdown` must be last (D-6).

### 6.2 Barrel additions

```ts
// src/features/courses/index.ts
export { LessonEditor } from './components/courses.lesson-editor'
export { normalizeMarkdown, assertRoundTrip } from './courses.markdown'
```

`courses.markdown-editor` is **not** exported from the barrel: Tiptap is browser-only, and leaking it would let a route import it into an SSR path and trip [§3.4](#34-ssr-hazard).

---

## 7. Editor Surface

### 7.1 View modes

Three modes, one state. The mode is a presentation concern and is not persisted per user.

| Mode        | Layout                | Use case                                                                            | Markdown editable |
| ----------- | --------------------- | ----------------------------------------------------------------------------------- | ----------------- |
| **Rich**    | Editor only (default) | Day-to-day authoring. Matches today's S-2.7 canvas.                                 | Indirectly        |
| **Split**   | Editor ‖ source       | Precise control; teaches the Markdown model to authors.                             | **Yes**           |
| **Preview** | Rendered output       | Check what students will see; also the "Content" check for the `min 50 chars` rule. | Read-only         |

Mode switch is a `role="tablist"` in the editor header, persisted to `localStorage` per user (client preference, not a server setting — avoids a Settings screen for a one-bit choice).

**Split-mode synchronisation contract:**

- Rich → Source: on editor `update`, debounce 300ms, then `editor.getMarkdown()` → source pane. The pane is **read-only** while it is being written to, to avoid feedback loops.
- Source → Rich: on source edit, debounce 300ms, then `editor.commands.setContent(value, { contentType: 'markdown' })`. Undo history resets per the Markdown extension's `setContent` override — **the spec accepts this**, and Split mode is presented as a "precision mode", with Undo behaving at the granularity of the last sync. Rich mode remains the recommended default.
- Both directions must pass `assertRoundTrip` ([§10.2](#102-round-trip-invariants)); a failure shows a blocking error rather than pushing divergent content.

### 7.2 Toolbar

Replaces the current inline `window.prompt`-driven bar. Grouped by role, with `aria-pressed` on every toggle and arrow-key roving tabindex per [Part 11 § Accessibility](11-Global-Standards.md#accessibility-specification).

| Group   | Controls                                                              | Markdown produced                    |
| ------- | --------------------------------------------------------------------- | ------------------------------------ |
| Blocks  | Paragraph · H2 · H3 · Blockquote · Code block · Horizontal rule       | `p`, `##`, `###`, `>`, fenced, `---` |
| Lists   | Bulleted · Numbered · Task list                                       | `-`, `1.`, `- [ ]`                   |
| Inline  | Bold · Italic · Underline · Strikethrough · Inline code · Link        | `**`, `*`, `~~`, `` ` ``, `[…]()`    |
| Insert  | Image (Content Library) · Table (insert 3×2) · Video embed · PDF link | `![…]()`, GFM table, link            |
| History | Undo · Redo                                                           | —                                    |

**Replacing `window.prompt` is a hard requirement, not a polish item.** `window.prompt` is blocking, unstyled, unscreen-reader-navigable in several contexts, and untestable. Link/embed insertion becomes a small dialog using the existing dialog primitives, which also gives link entry a place for the URL validation that S-2.7 already mandates ("Video URL: Must be valid YouTube/Vimeo URL") and which `saveLessonSchema` already enforces via `VIDEO_URL`.

**Media affordances are unchanged from S-2.7** — "Add Media" opens the Content Library picker (`LibraryAssetPicker`), and "Captions & transcript" navigates to [S-3.6](05-Content-Library.md#scr-3-6). Markdown authoring changes how _text_ is stored, not how library media is attached.

### 7.3 Keyboard

Per [Part 11 § Global Validation](11-Global-Standards.md#global-validation-and-feedback-patterns):

| Keys                 | Action                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Ctrl/⌘ + S`         | Force save now (bypasses the 60s timer)                                                                                            |
| `Ctrl/⌘ + Z` / `⇧Z`  | Undo / redo (Tiptap native)                                                                                                        |
| `Ctrl/⌘ + B / I / U` | Bold / italic / underline (Tiptap native)                                                                                          |
| `Ctrl/⌘ + K`         | Command Palette ([S-7.5](09-Shared-Components.md#scr-7-5)) — must not be swallowed by the editor                                   |
| `Tab` / `⇧Tab`       | Standard editor tab behaviour; the toolbar itself is a single tab stop with arrow-key navigation, per the list pattern in Part 11. |
| `Esc`                | Leave the source pane and return focus to the rich editor                                                                          |

The `Ctrl/⌘ + K` case matters: inside a ProseMirror surface it can be captured by the editor. The keymap must be registered at the document level with a guard, and covered by a test.

### 7.4 Accessibility

Beyond the Part 11 baseline, Markdown-specific obligations:

- Every toolbar control has an `aria-label` **and** a visible-or-tooltip text label; state is carried by `aria-pressed`, never by colour alone.
- View-mode switch exposes `role="tablist"` / `role="tab"` / `role="tabpanel"` with arrow-key navigation.
- The source pane is a real `<textarea>` with a programmatically associated label, so screen-reader and plain-keyboard users can author Markdown without touching the canvas.
- Syntax-support removals (tables without registered extensions, images) are prevented structurally by D-2, not by warning the user after the fact.
- Validation errors are announced via `aria-live="polite"`, and each message states both what is wrong and how to fix it.

---

## 8. Persistence & State

### 8.1 Autosave

[Part 11](11-Global-Standards.md#global-validation-and-feedback-patterns) mandates 60-second autosave in draft mode; this spec makes it concrete.

- **Timer:** 60s of _no typing_, not 60s wall-clock. A trailing debounce avoids saving mid-sentence.
- **Manual:** `Ctrl/⌘ + S` flushes immediately.
- **Dirty tracking:** derived from `editor.on('update')` _and_ the settings-pane `onChange`s, exactly as today — but `update` now also fires when Markdown and the rich doc diverge, so the same `dirty` flag covers both modes.
- **Save status indicator:** a caption-level `aria-live="polite"` region in the editor header cycling `All changes saved` → `Saving…` → `All changes saved at HH:MM`, and `Save failed — Retry` on error. Errors raise a toast ([S-7.2](09-Shared-Components.md#scr-7-2)) **and** leave the indicator in the failed state; the unsaved buffer is never discarded on failure.
- **Autosave is skipped** when the lesson is `in_review` (editing is locked, per S-2.7) and when the user is a Viewer/Reviewer (permission-aware UI, Part 11).
- **On unmount / navigation:** the existing [S-7.1](09-Shared-Components.md#scr-7-1) confirmation dialog covers the unsaved case; Markdown does not change that behaviour.

### 8.2 Concurrency

Unchanged and re-stated so the Markdown work does not regress it: `expectedRowVersion` is sent on every write; a mismatch is rejected server-side. On a `409`/version conflict the editor shows `This lesson was updated elsewhere. Reload to continue.` with a Reload action — it must **not** silently overwrite, and must not attempt an automatic Markdown merge. A diff-and-merge UI is explicitly out of scope ([§1.2](#12-non-goals)).

---

## 9. Server Contract

### 9.1 Server functions

Added to `src/features/courses/server/courses.lessons.ts`, all via `createServerFn` with `.validator()` / `.handler()`, and dynamically importing their `*.impl.server` modules per the existing pattern:

| Function                      | Method | Purpose                                                                     |
| ----------------------------- | ------ | --------------------------------------------------------------------------- |
| `saveLesson` _(modified)_     | POST   | Persists Markdown; stamps `bodyFormat`; enforces `rowVersion`.              |
| `validateLessonMarkdown`      | POST   | Server-side lint of a Markdown string ([§9.3](#93-server-side-validation)). |
| `exportLessonMarkdown`        | GET    | Returns the raw Markdown for a lesson (used by Copy/Download).              |
| `migrateLessonBodyToMarkdown` | POST   | Per-row migration trigger; no-op on an already-`markdown` row.              |

### 9.2 Validator

`courses.markdown.schema.ts` (Zod v4, matching `saveLessonSchema` style):

```ts
export const lessonMarkdownSchema = z.object({
  body: z.string().max(200_000).nullable(),
  bodyFormat: z.literal('markdown'),
  /** S-2.7: "Content: Required, min 50 chars." Measured on text, not markup. */
  textLength: z.number().int().min(0),
})
```

`bodyFormat: z.literal('markdown')` is the boundary enforcement for D-3.

### 9.3 Server-side validation

Because `MarkdownManager.parse()` is DOM-free ([§3.4](#34-ssr-hazard)), validation is genuinely server-side rather than a client-only courtesy:

- `textLength` is computed by parsing to a doc and concatenating `node.textContent`, so the S-2.7 "min 50 chars" rule measures **prose**, not Markdown punctuation. `**#**` has 1 character of prose, not 6 of markup.
- A **construct audit** rejects content that would be lossy under the registered extension set. Because D-2 registers images, tables, and task lists, the audit's job is narrower: it flags constructs the schema _cannot_ represent (e.g. footnotes, definition lists, raw HTML blocks) so the author learns at save time rather than discovering a diff later.
- The audit runs on **every** save, including legacy HTML-hydrated lessons, so a lesson is never silently rewritten into a lossy shape.

Failure shape: `ValidationError` with a machine-readable `code`, a human message stating what is wrong **and** how to fix it, and — where meaningful — a 1-based line number in the Markdown source, surfaced as a click-to-jump in the source pane.

---

## 10. Normalization & Invariants

### 10.1 Normalization

`normalizeMarkdown(md)` in `courses.markdown.ts` runs before persistence so that cosmetic churn never creates a dirty diff:

- Collapse 3+ consecutive blank lines to one.
- Trim trailing whitespace per line, and leading/trailing whitespace of the document.
- Normalize CRLF → LF.
- Strip the leading/trailing blank lines that table serialization emits (verified: tables round-trip with an extra leading and trailing newline).
- Leave delimiter choices alone. `_i_` → `*i*` and `<https://a>` → `[https://a](https://a)` are **semantically identical and stable**, so normalizing them would only add churn. Cosmetic-only equivalences are explicitly _not_ rewritten.

### 10.2 Round-trip invariants

These are the testable guarantees behind [G-2](#11-goals) and are the reason D-2 is non-negotiable.

| ID  | Invariant                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| RT1 | `serialize(parse(md))` is byte-identical to `normalizeMarkdown(md)` for the supported subset.                                                     |
| RT2 | `parse(serialize(doc))` yields a doc with the same shape as `doc`.                                                                                |
| RT3 | Every construct in the supported subset survives a **second** round trip unchanged (idempotence).                                                 |
| RT4 | Every construct in the loss table ([§3.3](#33-lossy-construct-audit-the-decisive-finding)) round-trips **losslessly** with the D-2 extension set. |
| RT5 | An empty/whitespace document never reaches `new Editor({ contentType: 'markdown' })` on a DOM-less runtime.                                       |

Verified round-trip stability with the D-2 set for: ATX headings H1–H6, paragraphs, bold/italic/strike/underline/inline-code, links (including in headings), bulleted/ordered/nested lists, task lists (including nested), blockquotes, fenced code blocks with and without a language, horizontal rules, images with and without a title, and GFM tables.

---

## 11. Review Workflow Integration

The Markdown change must not disturb the approval gate ([S-2.14](04-Courses.md#scr-2-14)).

| `reviewStatus`      | Editor behaviour                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `draft`             | Fully editable. Content and settings both autosave.                                                                                                                                     |
| `in_review`         | `editor.setEditable(false)`. All toolbar controls disabled **with explanatory tooltips** (Part 11 permission-aware UI: disabled-with-reason, never a silent no-op). Autosave suspended. |
| `changes_requested` | Editable; reviewer comments shown inline above the canvas; "Re-submit for review" enabled once `dirty`.                                                                                 |
| `approved`          | Read-only until an admin resets review, matching `courses.lessons.impl.server.ts`.                                                                                                      |

`submitLessonForReview` is unchanged: it flips `reviewStatus` and is body-format agnostic. The reviewer reads the lesson in **Preview** mode ([§7.1](#71-view-modes)) so what they approve is what students will see — this is a genuine improvement the Markdown surface makes available, and it is the mode reviewers should be defaulted into from the [S-2.14](04-Courses.md#scr-2-14) queue.

AI-generated quiz drafting ([S-2.16](04-Courses.md#scr-2-16)) consumes lesson text. Because `stripMarkdown()` already handles both HTML and Markdown, and the body is now always Markdown, that path is _simplified_ — but the ✨ labelling and explicit-accept rules in Part 11 are unchanged.

---

## 12. Implementation Plan

Ordered so each step is independently shippable and reversible.

| Step | Change                                                                                                                            | Gate                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1    | Add the 7 dependencies at `3.31.3` via `pnpm --filter @abugida/dashboard add …`. Check `pnpm-workspace.yaml` `allowBuilds` first. | `pnpm install` clean; no new native build.                     |
| 2    | Extract `LESSON_EDITOR_EXTENSIONS` + `courses.markdown-editor.tsx`; fix D-5; add `.ProseMirror` styles.                           | Existing S-2.7 behaviour unchanged; no `[tiptap warn]` output. |
| 3    | Add `courses.markdown.ts` (pure) + tests for RT1–RT4.                                                                             | `bun test` green; invariants proven on the supported subset.   |
| 4    | Schema: `body_format` column + `db:generate` + `db:migrate`.                                                                      | Migration applies cleanly; `db:generate` output reviewed.      |
| 5    | Write path: `bodyFormat: 'markdown'`, switch `getHTML()` → `getMarkdown()`.                                                       | Round-trip proven end-to-end in a real lesson.                 |
| 6    | Read path: `bodyFormat` on the DTO + dual hydration in the editor.                                                                | Legacy HTML lessons still open and save unchanged.             |
| 7    | `courses.legacy-html.ts` + migration script + run report.                                                                         | Report produced; unconvertible rows listed, not guessed.       |
| 8    | Autosave hook, view modes, toolbar rewrite, keyboard map, `validateLessonMarkdown`.                                               | A11y checks pass; `Ctrl/⌘+K` unblocked.                        |
| 9    | Migrate production data; re-run report until `skipped (unconvertible): 0` or every remainder is triaged.                          | Zero unexplained skips.                                        |

Steps 4–6 ship **before** 7, so a rollback never leaves a schema without a reader.

### 12.1 Testing

Tests live in `app/dashboard/tests/` and run on `bun test` (not vitest), matching the existing suite.

| File                              | Covers                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `courses.markdown.test.ts`        | `normalizeMarkdown`; RT1–RT4 over a fixture corpus; idempotence over generated combinations.          |
| `courses.legacy-html.test.ts`     | HTML→doc for every tag in the [§5.3](#53-migration) table; the unknown-tag abort branch; idempotence. |
| `courses.markdown-schema.test.ts` | `bodyFormat` literal rejection; 200k cap; `textLength` measures prose not markup.                     |
| `courses.markdown.keymap.test.ts` | `Ctrl/⌘+K` reaches the Command Palette from inside the editor; `Ctrl/⌘+S` flushes.                    |

The round-trip fixtures double as the **regression net for the D-2 extensions**: if someone later removes `extension-image`, the image fixture fails instead of the content quietly disappearing. Name the fixtures after the [§3.3](#33-lossy-construct-audit-the-decisive-finding) table so the failure message points straight at the cause.

Pure-logic tests need no DOM; the Editor-construction tests (RT5) run against the browser-only path and are covered by the E2E/manual pass rather than `bun test`.

---

## 13. Risks & Mitigations

| Risk                                                                         | Impact                             | Mitigation                                                                                                                     |
| ---------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| An extension is dropped from the list later, silently re-enabling lossiness. | Silent data loss on the next save. | Fixture corpus pinned in `courses.markdown.test.ts` fails loudly on removal.                                                   |
| HTML injection through raw Markdown.                                         | Stored XSS rendered to students.   | Student render path uses `streamdown` with HTML disabled; the editor never accepts raw HTML nodes; `Image.allowBase64: false`. |
| Un-migrated lessons edited by a new client write Markdown over HTML rows.    | Mixed formats in one course.       | `bodyFormat` on the DTO plus dual hydration; save path stamps `'markdown'`, making the transition self-completing per row.     |
| Split mode confuses authors or breaks Undo.                                  | Poor adoption.                     | Rich is the default; Split is opt-in and labelled a precision mode; the Undo caveat is documented in the UI.                   |
| `marked` behaves differently in future minor bumps.                          | Parse drift.                       | `@tiptap/markdown` pins `marked` internally; round-trip tests fail loudly on drift rather than corrupting silently.            |
| Dual markdown in the body breaks the 200k cap sooner than HTML.              | Save rejections on large lessons.  | Cap is unchanged at 200k; normalization runs first, and the error message reports actual vs. limit.                            |

---

## 14. Out of Scope

Deferred deliberately, with the reason:

- **Collaborative editing / CRDT merge** — the `rowVersion` guard is the current model; a merge UI is a separate, much larger piece of work.
- **Git-style revision history and diff view** — a future spec. Note that Markdown is a _prerequisite_ for readable diffs, which is part of why D-3 is worth the migration.
- **AI _generating_ Markdown** — [§1.2](#12-non-goals).
- **LaTeX / math nodes** — common in language courses. Requires a custom node with a `parseMarkdown`/`renderMarkdown` spec; the `@tiptap/core` `markdown` namespace ([§3.1](#31-the-installed-editor-cannot-emit-markdown-out-of-the-box)) exists precisely for that, and it is a good first candidate once this spec lands.
- **Custom shortcode embeds** (e.g. `{{quiz:abc}}`) — same mechanism, later.
- **Per-user source-pane syntax highlighting** — the pane is a plain `<textarea>` for accessibility ([§7.4](#74-accessibility)); a CodeMirror instance would replace it and needs its own a11y review.

---

## 15. Open Questions

| #   | Question                                                                                                                          | Owner        | Blocks |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------ |
| Q-1 | Should the source pane be a `<textarea>` (chosen, a11y-first) or a CodeMirror 6 instance with a documented a11y layer?            | Design + Eng | Step 8 |
| Q-2 | Do instructors need fenced math in lessons? If yes it becomes the first custom `parseMarkdown`/`renderMarkdown` node.             | Curriculum   | §14    |
| Q-3 | Is per-lesson Markdown export ([§9.1](#91-server-functions)) needed for the Content Library, or is lesson body export sufficient? | Product      | Step 8 |
| Q-4 | Should the reviewer queue deep-link straight into Preview mode? ([§11](#11-review-workflow-integration))                          | Product      | Step 8 |
| Q-5 | Do `01`-`11` UX specs need updating to mention the three view modes, or is this companion document sufficient?                    | Docs         | —      |

---

## Appendix A — Verification Procedure

Every capability claim in [§3](#3-toolchain-constraint-analysis-markdown-support-in-tiptap-3313) was established empirically against the installed tree, not from documentation. To re-verify after a dependency change:

**1. Confirm Markdown support is not already in core.**

```bash
node -e "console.log(Object.keys(require('@tiptap/pm/package.json').exports))"
# If './markdown' appears, Tiptap gained first-class Markdown; re-read this spec's §3.
```

**2. Confirm the base extensions ship Markdown handlers.**

```bash
grep -o "renderMarkdown\|parseMarkdown" \
  node_modules/@tiptap/extension-*/dist/index.js | sort -u
```

**3. Confirm the version pin still lines up.**

```bash
node -e "
const a=require('@tiptap/markdown/package.json');
console.log(a.version, JSON.stringify(a.peerDependencies));
"
# Expect: 3.31.3  {"@tiptap/pm":"3.31.3","@tiptap/core":"3.31.3"}
```

**4. Prove round-trip stability and detect lossiness.** Construct an editor with the [§6.1](#61-the-extension-list) extension list, then for each fixture assert `serialize(parse(fixture))` is stable across two passes. The authoritative form of this check is the committed suite (`courses.markdown.test.ts`), not an ad-hoc script — a spec claim that is not asserted by a test is a claim that decays.

**5. Reproduce the SSR hazard.** Construct `new Editor({ content: '', contentType: 'markdown' })` in a DOM-less runtime and confirm it throws. If a future Tiptap fixes this, D-8 can be revisited.

---

## Appendix B — Change Log for This Document

| Date       | Change                                                                                | Author |
| ---------- | ------------------------------------------------------------------------------------- | ------ |
| 2026-09-28 | Initial specification. Toolchain findings verified empirically against Tiptap 3.31.3. | —      |
