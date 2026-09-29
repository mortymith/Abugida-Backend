# Course Editor — Markdown Lesson Authoring (Tiptap)

> **Abugida Academy — Feature Specification** · Companion to Part 04 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Global Standards](11-Global-Standards.md) · [Courses →](04-Courses.md)

**Screen IDs covered:** `S-2.7` Lesson Editor (Markdown authoring surface), with supporting references to `S-2.2`, `S-2.6`, `S-2.8`, `S-2.13`, `S-2.14`, `S-2.16`, `S-2.17`, `S-2.20`, `S-2.21`, `S-2.23`, `S-3.1`, `S-3.6`, `S-7.1`, `S-7.2`, `S-7.8`.

**Status:** Approved for implementation. Every technical claim in [§3](#3-toolchain-constraint-analysis-markdown-support-in-tiptap-3313) and [Appendix A](#appendix-a--verification-procedure) was verified against the installed dependency tree, not inferred from documentation.

**Revision 2 (Course Workspace):** the content model, storage contract, extension list, and round-trip invariants in this document are **unchanged**. Revision 2 adds one section — [§16](#16-revision-2--workspace-integration) — describing how this editor is hosted inside the Course Workspace's curriculum pane, and it updates [§8.1](#81-autosave) and [§15](#15-open-questions) where the surrounding UX moved.

**Revision 3 (Editor completeness):** closes the behaviours this document had delegated to a sibling spec or simply omitted — draft durability, split-mode conflict resolution, offline save states, three-option conflict handling, image upload and alt text, paste sanitisation, find/replace and read time, table and code-block keyboard paths, the preview parity table, a reference audit, minimal version history, bounded in-editor AI drafts, heading rules, per-block `lang`, and instrumentation. **The content model, storage contract, and RT1–RT5 are unchanged.**

**Relationship to the UX specification:** [Part 04 § S-2.7](04-Courses.md#scr-2-7) remains the authoritative definition of the Lesson Editor's _layout, states, validation, and navigation_. This document does **not** restate or replace it. It specifies the **content model and editor implementation** behind the item pane's content canvas, and the persistence contract that the rest of Section 2 depends on.

---

## What changed in Part 12 (Revision 3)

- **The unload guard was delegated, never specified.** §8.1 defined a 60s _no-typing_ timer, so a user who typed and closed the tab lost everything. [§8.1.1](#811-draft-mirroring-and-the-unload-guard) now implements the IndexedDB mirror [Part 04 S-2.7](04-Courses.md#scr-2-7) declares, with a restore prompt before hydration and `beforeunload` guarding `dirty`.
- **Split-mode sync had an undefined data-loss edge.** §7.1 now carries a `{rich changed, source changed} × {round-trip ok, fails}` state table: the unedited pane is authoritative, both-changed resolves to Rich with a timed Undo, and a round-trip failure freezes the source pane rather than mutating the editor.
- **Offline was an undefined save state.** [§8.1.2](#812-the-autosave-matrix) gives the full matrix (`dirty × online|offline × saving|failed × locked|editable`) and §13 gains the matching risk row. A stale queued write resolves to **conflict**, never a silent overwrite.
- **Conflict offered only Reload**, which destroys up to 60s of typing. [§8.2](#82-concurrency) now specifies the two-column Markdown diff with **Keep mine / Take theirs / Compare**, matching Part 04's Row Conflict. Merge stays out of scope; discarding the user's work does not.
- **Media, paste, find, tables, and code blocks were named but unspecified.** New [§7.5](#75-image-insertion) – [§7.9](#79-headings-and-the-outline) cover drop/paste upload, progress, required alt text, `transformPastedHTML`, find/replace with word count and read time, the table keyboard contract, and the heading rules the round-trip invariants already implied.
- **Version history was deferred, which breaks the reviewer's job.** [§14.1](#141-version-history-minimal-not-git) adds a `lessons.body_revisions` append-only table and a minimal diff — enough to review a _change_ without building Git.
- **Preview parity was asserted and then stopped.** [§16.3.1](#1631-preview-parity) now carries a nine-row parity table, including the rule that Preview renders inside the S-2.21 Preview Frame and Rich/Split never resize the workspace behind them.
- **AI was disclaimed then referenced as if it existed.** [§11.1](#111-ai-authored-body-content-explicitly-bounded) bounds it: dashed `--color-ai-tint` `AIDraftBlock` ranges, literal **"AI draft"** label, explicit scoped Regenerate, human Accept, and `<!-- ai-draft:unaccepted -->` in the source pane.
- **Localization, type rules, and instrumentation are now normative.** Per-block `lang` and `dir="auto"` ([§7.4](#74-accessibility)), the Part 11 Noto Sans Ethiopic / `line-height: 1.6` / no-line-clamp rules on `.ProseMirror`, the script-aware read-time formula, a broken-link/image-404 reference audit ([§9.4](#94-reference-audit)), and budgets + acceptance criteria + events ([§12.2](#122-success-criteria--instrumentation)).
- **The implementation plan was not reversible as claimed.** Step 5 is now gated behind a `markdownWritesEnabled` workspace flag, so rollback is flag-off rather than deploy-revert ([§12.0](#120-the-rollout-gate-step-55)).

[§5](#5-storage-model), [§10](#10-normalization--invariants), and RT1–RT5 are **unchanged by this revision**, as [§16.5](#165-unchanged-by-this-revision) already declared for Revision 2. Revision 3 **reconciles** rather than restates: where [Part 04 S-2.7](04-Courses.md#scr-2-7) already governs a behaviour — the IndexedDB key, the offline banner, the conflict options, `content_language`, the `RC-4` base-variant rule, the budget figures — this document implements Part 04's version and says so, including in the two places where Part 04 was ambiguous.

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

- **Not a redesign of the Lesson Editor layout** (owned by S-2.7) — but Revision 2 does relocate it into the workspace item pane, which is a hosting change only; see [§16](#16-revision-2--workspace-integration).
- Not collaborative/multi-user editing or CRDT merge — out of scope; the `rowVersion` guard remains the concurrency control.
- Not a general-purpose Markdown IDE. No file tree, no multi-file vault, no Git-style diffing.
- Not an **autonomous** AI authoring surface. The ✨ AI generators ([S-2.11](04-Courses.md#scr-2-11), [S-2.16](04-Courses.md#scr-2-16)) consume lesson text as _input_ and never write to `lessons.body` on their own. **Revision 3:** the one narrow exception is explicit, human-accepted insertion of generated **body** text, which is specified in [§11.1](#111-ai-authored-body-content-explicitly-bounded) and is bounded by the same human-in-the-loop rule.
- Not a replacement for [S-3.6](05-Content-Library.md#scr-3-6) transcription; the editor links to it, it does not embed it.

---

## 2. As-Built Inventory (verified)

The following is the current state of the code this spec modifies. It is recorded so reviewers can detect drift before implementing.

| Layer         | Location                                                     | Current behaviour                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route         | `src/routes/_app/courses/$courseId/lessons/$lessonId.tsx`    | Guards with `requireRolesBeforeLoad(['admin','editor'])`; composes `LessonEditor` + quiz modals. **Revision 2:** this becomes an **alias** into the workspace — `?tab=curriculum&item=<lessonId>` — and must not host a second editor. |
| Route         | `src/routes/_app/courses/$courseId.tsx`                      | The Course Detail tabbed screen. **Revision 2:** becomes the Course Workspace shell with `?tab=` and `?item=`.                                                                                                                         |
| Component     | `src/features/courses/components/courses.lesson-editor.tsx`  | 573 lines. `useEditor` with `StarterKit` + `LinkExtension` + `Placeholder`.                                                                                                                                                            |
| Serialization | same                                                         | `editor.commands.setContent(body)` on load, `editor.getHTML()` on save. **HTML, not Markdown.**                                                                                                                                        |
| Toolbar       | same (inline `ToolbarButton`)                                | 8 buttons, `window.prompt` for URLs, no menu/keyboard map, no `aria-pressed` grouping semantics beyond per-button.                                                                                                                     |
| Server fn     | `src/features/courses/server/courses.lessons.ts`             | `getLessonForEdit`, `saveLesson`, `submitLessonForReview` via `createServerFn`.                                                                                                                                                        |
| Validation    | same — `saveLessonSchema`                                    | `body: z.string().max(200_000).nullable()`, `expectedRowVersion: z.number().int().positive()`.                                                                                                                                         |
| Persistence   | `src/features/courses/server/courses.lessons.impl.server.ts` | Writes `lessons.body` verbatim. Optimistic concurrency via `rowVersion`.                                                                                                                                                               |
| Storage       | `packages/database/src/schema/catalog/lessons.ts`            | `body: text('body')` — no format discriminator.                                                                                                                                                                                        |
| Editor CSS    | `src/styles.css`                                             | **Contains no ProseMirror/Tiptap rules.** Styling is unstyled default ProseMirror today.                                                                                                                                               |
| Tests         | `tests/courses.spec-04.test.ts`                              | Covers pure logic (curriculum tree, review state, pricing). No editor-serialization coverage.                                                                                                                                          |

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

| ID  | Decision                                                                                                                            | Rationale                                                                                                                                                                                                                                                                                            | Status   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D-1 | Add `@tiptap/markdown@3.31.3` as a direct dashboard dependency.                                                                     | Only version-matched, first-party Markdown runtime. Peer deps already satisfied. No Tiptap upgrade.                                                                                                                                                                                                  | Accepted |
| D-2 | Also add `@tiptap/extension-image`, `-table`, `-table-row`, `-table-cell`, `-table-header`, `-task-list`, `-task-item` at `3.31.3`. | Without these, images/tables/task-lists are silently destroyed on save ([§3.3](#33-lossy-construct-audit-the-decisive-finding)). Images and checklists are core to lesson authoring.                                                                                                                 | Accepted |
| D-3 | Markdown is the **sole** persisted format. No dual HTML column.                                                                     | Dual formats guarantee drift. A single source of truth ([G-5](#11-goals)).                                                                                                                                                                                                                           | Accepted |
| D-4 | Add a `body_format` discriminator to `lessons`; migrate existing rows.                                                              | Required to read legacy rows correctly. Sniffing for `<` is unreliable.                                                                                                                                                                                                                              | Accepted |
| D-5 | Remove the duplicate `LinkExtension`; configure link through StarterKit.                                                            | Fixes [§3.5](#35-pre-existing-defect-to-fix-in-passing).                                                                                                                                                                                                                                             | Accepted |
| D-6 | Register `Markdown` **last** in the extension array.                                                                                | It overrides `setContent`/`insertContent`; it must win command resolution.                                                                                                                                                                                                                           | Accepted |
| D-7 | Migration runs **server-side** using `MarkdownManager.serialize()` over a constrained HTML→doc converter.                           | Legacy HTML was produced by a known, fixed schema; a constrained converter is safer than requiring every author to reopen every lesson.                                                                                                                                                              | Accepted |
| D-8 | Editor is client-only (`immediatelyRender: false`).                                                                                 | [§3.4](#34-ssr-hazard).                                                                                                                                                                                                                                                                              | Accepted |
| D-9 | Tiptap/ProseMirror base styles added to `src/styles.css`.                                                                           | Currently unstyled ([§2](#2-as-built-inventory-verified)); the Markdown split/preview surface depends on a predictable `.ProseMirror` box. Type rules are fixed by [Part 11 § Localization & Formatting](11-Global-Standards.md#localization--formatting) and restated in [§7.4](#74-accessibility). | Accepted |

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

- `Image.configure({ allowBase64: false })` keeps pasted base64 blobs from reaching `lessons.body`. Images are served from the Content Library ([S-3.1](05-Content-Library.md#scr-3-1)); the picker is one of **four** insertion routes — the others are drag-drop, clipboard paste, and URL — all specified in [§7.5](#75-image-insertion).
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
- Both directions must pass `assertRoundTrip` ([§10.2](#102-round-trip-invariants)) before the result is committed.

**Concurrent-edit resolution.** A 300ms window in which _both_ panes are edited was undefined, and "a blocking error" did not say what was blocked after the debounce had already overwritten the source. Resolved as follows — the pane **not edited since the last successful sync is authoritative**.

| Rich changed | Source changed | `assertRoundTrip` | Resolution                                                                                                                                                                                                                           |
| ------------ | -------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| –            | ✔              | ok                | Source → Rich. Undo history resets per [above](#71-view-modes).                                                                                                                                                                      |
| ✔            | –              | ok                | Rich → Source.                                                                                                                                                                                                                       |
| ✔            | ✔              | ok                | **Rich wins.** The source pane reverts to the last synced string, a toast reads _"Source edits were overwritten by the rich editor"_ with a timed **Undo**, and the mode switches to **Rich** so the conflict cannot recur silently. |
| –            | ✔              | **fails**         | Editor **not** modified. Source pane freezes **read-only** with an inline error naming the construct, plus **Restore last good source**.                                                                                             |
| ✔            | ✔              | **fails**         | Editor **not** modified. Both panes freeze **read-only**; the same inline error and **Restore last good source** action, plus **Copy Markdown** so the author's text is never trapped.                                               |

> **Why "Rich wins" and not a merge:** merging prose requires judgement, and a silent merge is worse than a visible loss with an Undo ([§1.2](#12-non-goals)). Making the losing edit recoverable and naming the overwrite out loud is the contract.
>
> **Freeze, do not revert, on round-trip failure:** a non-round-tripping string is exactly the [§3.3](#33-lossy-construct-audit-the-decisive-finding) failure this document exists to prevent. Reverting the pane would destroy the string that revealed the bug, so the pane keeps the text and stops accepting edits until the author resolves it.

### 7.2 Toolbar

Replaces the current inline `window.prompt`-driven bar. Grouped by role, with `aria-pressed` on every toggle and arrow-key roving tabindex per [Part 11 § Accessibility](11-Global-Standards.md#accessibility-specification).

| Group   | Controls                                                              | Markdown produced                    |
| ------- | --------------------------------------------------------------------- | ------------------------------------ |
| Blocks  | Paragraph · H2 · H3 · Blockquote · Code block · Horizontal rule       | `p`, `##`, `###`, `>`, fenced, `---` |
| Lists   | Bulleted · Numbered · Task list                                       | `-`, `1.`, `- [ ]`                   |
| Inline  | Bold · Italic · Underline · Strikethrough · Inline code · Link        | `**`, `*`, `~~`, `` ` ``, `[…]()`    |
| Insert  | Image (Content Library) · Table (insert 3×2) · Video embed · PDF link | `![…]()`, GFM table, link            |
| History | Undo · Redo                                                           | —                                    |

**Toolbar keyboard model.** The bar is a **single tab stop**: one `role="toolbar"` container, roving `tabindex` so exactly one control in the whole bar is in the tab order.

| Key               | Action                                                          |
| ----------------- | --------------------------------------------------------------- |
| `←` / `→`         | Move within the current group, wrapping at the ends             |
| `↑` / `↓`         | Move between groups, landing on the same index where one exists |
| `Home` / `End`    | First / last control **in the current group**                   |
| `Enter` / `Space` | Activate                                                        |
| `Esc`             | Return focus to the editor at the last caret position           |

Groups are also separated visually and by an `aria-label` per group (`Blocks`, `Lists`, `Inline`, `Insert`, `History`) so the `↑`/`↓` move is not announced as a jump across unrelated controls.

**Heading controls are H2 and H3 only, and that is a rule, not a gap.** H1 is reserved for the item title and is rejected by the construct audit ([§7.9](#79-headings-and-the-outline)). The RT fixture set in [§10.2](#102-round-trip-invariants) verifies H1–H6 because the _reader_ must round-trip H1–H6 in imported, pasted, and migrated bodies — not because the author can produce them. RT1–RT5 are unchanged. Level-skipping is a no-op with the tooltip _"Cannot skip a heading level."_

**Replacing `window.prompt` is a hard requirement, not a polish item.** `window.prompt` is blocking, unstyled, unscreen-reader-navigable in several contexts, and untestable. Link/embed insertion becomes a small dialog using the existing dialog primitives, which also gives link entry a place for the URL validation that S-2.7 already mandates ("Video URL: Must be valid YouTube/Vimeo URL") and which `saveLessonSchema` already enforces via `VIDEO_URL`.

**Link dialog** ([S-7.1](09-Shared-Components.md#scr-7-1) primitives), in field order:

| Field                       | Rules                                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Link text**               | Prefilled from the current selection; empty means the URL becomes the text. Required.                                                                                                                    |
| **URL**                     | Validates on **blur** and on **submit**; `Enter` in this field submits. An invalid value shows the error inline, moves focus to the field, and **does not** close the dialog.                            |
| **Opens in new tab**        | Checkbox, default on for external hosts. Emits `target="_blank" rel="noopener noreferrer"` (D-5).                                                                                                        |
| **Video embed** _(variant)_ | Replaces **URL** with a single Video URL field. A YouTube/Vimeo URL that fails `VIDEO_URL` shows _"Not a valid YouTube or Vimeo URL"_ **inline**, keeps focus in the field, and never closes the dialog. |

`Esc` closes the dialog and returns focus to the toolbar control that opened it. The dialog is a modal, so focus is trapped and restored per Part 11.

**Media affordances.** "Add Media" opens the Content Library picker (`LibraryAssetPicker`) and "Captions & transcript" navigates to [S-3.6](05-Content-Library.md#scr-3-6) — both unchanged from S-2.7. Revision 3 adds the four insertion routes, upload states, and the alt-text gate in [§7.5](#75-image-insertion); Markdown authoring changes how _text_ is stored, not how library media is attached.

### 7.3 Keyboard

Per [Part 11 § Global Validation](11-Global-Standards.md#global-validation-and-feedback-patterns):

| Keys                 | Action                                                                                                                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Ctrl/⌘ + S`         | Force save now (bypasses the 60s timer)                                                                                                                                                                               |
| `Ctrl/⌘ + Z` / `⇧Z`  | Undo / redo (Tiptap native)                                                                                                                                                                                           |
| `Ctrl/⌘ + B / I / U` | Bold / italic / underline (Tiptap native)                                                                                                                                                                             |
| `Ctrl/⌘ + K`         | Command Palette ([S-7.5](09-Shared-Components.md#scr-7-5)) — must not be swallowed by the editor                                                                                                                      |
| `Ctrl/⌘ + F`         | Find bar ([§7.6](#76-find-replace-word-count-and-read-time)) — must also be intercepted inside the source `<textarea>`                                                                                                |
| `⇧ + Ctrl/⌘ + H`     | Replace, opening the find bar in replace mode                                                                                                                                                                         |
| `⇧ + F10`            | Context menu for the block, row, or cell under the caret ([§7.7](#77-tables-and-code-blocks), [§7.9](#79-headings-and-the-outline))                                                                                   |
| `Tab` / `⇧Tab`       | Standard editor tab behaviour inside prose; **cell-to-cell inside a table** ([§7.7](#77-tables-and-code-blocks)). The toolbar itself is a single tab stop with arrow-key navigation, per the list pattern in Part 11. |
| `Esc`                | Leave the source pane and return focus to the rich editor; leave a code block's controls and restore the caret to the nearest block ([§7.7](#77-tables-and-code-blocks))                                              |

The `Ctrl/⌘ + K` case matters: inside a ProseMirror surface it can be captured by the editor. The keymap must be registered at the document level with a guard, and covered by a test. `Ctrl/⌘ + F` has the same hazard in the source `<textarea>` and the same remedy.

### 7.4 Accessibility

Beyond the Part 11 baseline, Markdown-specific obligations:

- Every toolbar control has an `aria-label` **and** a visible-or-tooltip text label; state is carried by `aria-pressed`, never by colour alone.
- View-mode switch exposes `role="tablist"` / `role="tab"` / `role="tabpanel"` with arrow-key navigation.
- The source pane is a real `<textarea>` with a programmatically associated label, so screen-reader and plain-keyboard users can author Markdown without touching the canvas.
- Syntax-support removals (tables without registered extensions, images) are prevented structurally by D-2, not by warning the user after the fact.
- Validation errors are announced via `aria-live="assertive"`. This is a correction: Part 11 and [S-7.8](09-Shared-Components.md#scr-7-8) rule 5 reserve `assertive` for error and conflict, and `polite` here would queue an error behind the next keystroke's chatter. Each message states both what is wrong and how to fix it.
- **Structural-change announcements are the delicate case.** Only changes the author cannot perceive from the caret need announcing; adding a block does not, because the caret landing in the new block _is_ the signal.

**Type rules (D-9, [Part 11 § Localization & Formatting](11-Global-Standards.md#localization--formatting)).** These bind `.ProseMirror` and the preview surface and are not screen-level overrides:

| Rule                | Value                                                                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `font-family`       | `var(--font-ui)` → `Inter, "Noto Sans Ethiopic", system-ui, sans-serif`                                                                                                                                               |
| `line-height`       | **1.6** when the lesson's language is `am` / `ti` / `gez`, 1.5 otherwise — switched by a `:lang()`-derived class set from `courses.content_language` ([Part 04 S-2.20](04-Courses.md#scr-2-20)), overridable per item |
| `letter-spacing`    | `normal` on every text node. Never `0.01em`-style tracking on Ethiopic                                                                                                                                                |
| Truncation          | **No `line-clamp`, no fixed height on any text node, and no truncation on the source pane.** Growth of 30–40% must not clip                                                                                           |
| Source `<textarea>` | `var(--font-mono)` at a size that fits Ge'ez syllabaries at **320px** with no horizontal scroll; the textarea grows with content, never scrolls vertically inside a fixed box                                         |

**Per-block `lang`.** A `lang` attribute is a first-class authoring feature, not a global document setting:

- An inline mark run gains a `lang` of `am` / `ti` / `gez` / `en`, set from the context-menu action **"Set language for selection"** ([Part 11 § Accessibility](11-Global-Standards.md#accessibility-specification)).
- It is stored as `<span lang="am">` in HTML-derived content and is **retained in the DTO** — the DTO's content-language field comes from `courses.content_language` (overridable per item), and the mark's `lang` attribute survives the Markdown round trip via a validated inline-HTML subset. A `lang` the construct audit cannot serialise is an `INLINE_HTML_UNSUPPORTED` advisory, not a silent strip.
- Mixed-direction runs render inside `dir="auto"`. Ge'ez is LTR, but an author mixing Ge'ez with a Latin-accented term still gets correct caret and punctuation behaviour without a page-level direction change.
- A **missing or mismatched `lang` is an advisory readiness check, never a save error** — it blocks publish readiness ([S-7.11](09-Shared-Components.md#scr-7-11)) and never autosave.

### 7.5 Image insertion

"Add Media opens the picker" was the whole of Revision 2's media story, which left drag-drop, progress, failure, and alt text undefined. All four insertion routes converge on one path:

| Route               | Behaviour                                                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Add Media**       | `LibraryAssetPicker` ([S-3.1](05-Content-Library.md#scr-3-1)) — unchanged                                                                                                                    |
| **Drag-drop**       | Dropped files go through the [S-7.12](09-Shared-Components.md#scr-7-12) drop zone, upload to the Content Library, then insert at the drop position                                           |
| **Clipboard paste** | A pasted `image/*` file follows the same route; a pasted **base64 data URI is rejected** with _"Paste a file, not image data."_ (`Image.allowBase64: false`, [§6.1](#61-the-extension-list)) |
| **URL**             | A pasted or typed absolute image URL inserts directly after a HEAD check ([§9.4](#94-reference-audit))                                                                                       |

**Insertion sequence:**

1. The node is committed as a `spinner` placeholder at the caret, carrying `aria-busy="true"` and the label _"Uploading image…"_. It is **not** written to `lessons.body` while uploading.
2. Upload resolves → the placeholder swaps to the image node, `![alt](assetUrl)` in Markdown. Per-file progress, cancel, retry, and **resume** all come from [S-7.12](09-Shared-Components.md#scr-7-12); progress starts within 1 s of the drop.
3. Upload **fails** → the node stays in place with **Retry** and **Remove** and an inline error. **It never writes to `lessons.body`.** A failed upload is not a save error and does not raise a conflict.

**Alt text is a gate, not a suggestion.** Before the node is committed, an **Alt text** field opens — `aria-label`d, required, non-empty, ≤ 200 characters, prefilled from the asset's filename and validated as non-whitespace. `validateLessonMarkdown` rejects an empty-alt image as `IMAGE_ALT_MISSING` with a 1-based line number ([§9.3](#93-server-side-validation)), so an image cannot reach students without it — the same guarantee Part 11 § Media Accessibility gives video captions. In Split mode the gate also applies to a hand-typed `![](…)` in the source pane, as an inline construct error with a click-to-jump.

### 7.6 Find, replace, word count, and read time

Absent entirely from Revision 2, which made a 5,000-word lesson unnavigable.

**Find and replace.** `Ctrl/⌘ + F` opens the find bar; `⇧ + Ctrl/⌘ + H` opens it in replace mode. Matches run against the **source string** and are then mapped to document positions, so search semantics are identical in Rich and Split:

| Mode       | On match                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| **Rich**   | The editor scrolls to the match and selects the range                                                        |
| **Split**  | **Both** panes highlight the same line — source line, and the corresponding rich block                       |
| **Source** | The native selection moves to the match; the browser's own find UI is intercepted so the bar is the only one |

- Match count announces as **"0 of N matches"** (and "No matches") in an `aria-live="polite"` region, **debounced 300 ms** — announcing per keystroke floods a screen reader at typing speed.
- `Enter` / `⇧Enter` cycle matches and wrap; `Replace` and `Replace all` operate on the source string and re-sync through the [§7.1](#71-view-modes) contract.
- **`Ctrl/⌘ + F` must not be swallowed by the browser inside the source `<textarea>`.** ProseMirror captures it; the keymap is registered at document level with the same guard as `Ctrl/⌘ + K` ([§7.3](#73-keyboard)) and covered by `courses.markdown.keymap.test.ts`.

**Word count and read time** compute from the **same `textContent`** used for the S-2.7 `min 50 chars` rule ([§9.3](#93-server-side-validation)) — never from the Markdown string, so `**#**` counts as one character of prose. Both are **debounced 1000 ms** and render in the **pane footer beside the media count**, using the Part 11 script-aware formula: `ceil(wordCount / 180)` for `am`/`ti`/`gez`, `/ 220` otherwise. Both are `aria-label`d with the full sentence (_"1,240 words · about 7 minutes to read"_) so the abbreviation is not the only form.

### 7.7 Tables and code blocks

`Table.configure({ resizable: false })` ([§6.1](#61-the-extension-list)) is exactly what makes a keyboard path mandatory: with no drag handle, a mouse user and a keyboard user must reach every cell the same way.

**Tables:**

| Key                            | Action                                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab`                          | Next cell; **exiting the last cell creates a new row** and moves into it                                                                             |
| `⇧Tab`                         | Previous cell; from the first cell leaves the table into the preceding block                                                                         |
| `⇧F10` (or the visible handle) | Opens the row/column context menu: Insert row above/below · Insert column left/right · Delete row · Delete column · Delete table · Toggle header row |

- The table is a **single `role="grid"` composite**, not a stop per cell. `aria-rowcount` and `aria-colcount` are announced on entry: _"Table, 4 rows by 3 columns."_ `Delete row` / `Delete column` on a one-row table is **disabled with a reason** (_"A table needs at least one row and one column"_), never a silent no-op.
- With `resizable: false` there is **no** resize drag. A table wider than the pane **scrolls horizontally inside a `tabindex="0"` region with a visible scrollbar** and an `aria-label` of _"Table content, scrollable"_, so the scroll region itself is keyboard-reachable. No `aria-hidden` scrolling container, and no fixed height.

**Code blocks** get a language `<select>` (the languages `saveLessonSchema` accepts, plus **Plain text**), a **Copy code** button ([S-7.12](09-Shared-Components.md#scr-7-12) `CopyButton`, with the Undo-free success state per that primitive), and `Escape` returning the caret to the nearest block start so the author is not trapped in the block controls. Changing the language rewrites the fence info string only.

**No syntax highlighting in v1.** This is a deliberate build-flag decision, not a missing dependency: highlighting a ProseMirror code block requires either a decoration layer that fights the caret or a separate editor instance, and neither is worth the round-trip risk in the same release that introduces Markdown. Highlighting is a **flag, not a dependency** — the extension list in [§6.1](#61-the-extension-list) is unchanged and a highlight layer is additive.

### 7.8 Paste sanitisation

`transformPastedHTML` — a single hook on the editor, pure and unit-testable in `courses.markdown.ts` — is the only path clipboard HTML takes. Revision 2 said nothing, so a paste from Word or Google Docs imported a page of `mso-` markup and inline styles into the body.

| Rule                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strip `style`, `class`, `id`, and every `mso-*` / `Mso*` attribute unconditionally — the editor's stylesheet is the only styling.                                                                                                                                                                                                         |
| Remove `<o:p>` and Office XML namespace nodes entirely.                                                                                                                                                                                                                                                                                   |
| `<b>` / `<strong>` → **bold** mark; `<i>` / `<em>` → **italic** mark. A `<b>`/`<i>` wrapper carrying **no semantic weight** (empty, whitespace-only, or nested inside another `<b>`/`<i>`) is unwrapped, not converted — this is what stops Word's double-wrapping from producing `***bold***`.                                           |
| `div` and `span` unwrap to their text content.                                                                                                                                                                                                                                                                                            |
| Two or more consecutive **empty** paragraphs collapse to one — a paste never introduces a run of blank blocks.                                                                                                                                                                                                                            |
| A pasted **`<table>`** converts to a GFM table **only for spreadsheet TSV** (the `text/html` clipboard flavour of a range copied from Sheets/Excel). An arbitrary web table pastes as its cell **text**, one row per paragraph — a general HTML→GFM table converter is a data-loss surface and is out of scope ([§14](#14-out-of-scope)). |
| A pasted **image** follows [§7.5](#75-image-insertion) and never lands as a data URI.                                                                                                                                                                                                                                                     |

**Undo on first rich paste.** The **first** rich-mode paste in a session raises a toast ([S-7.2](09-Shared-Components.md#scr-7-2)): _"Pasted content cleaned up"_ with a timed **Undo** that restores the raw selection. Every subsequent paste is silent — an Undo affordance on every keystroke-level action is noise, and `Ctrl/⌘ + Z` always works regardless. A paste that changed anything also fires `lesson_editor_paste_sanitized` ([§12.2](#122-success-criteria--instrumentation)) with the rule that fired, never the content.

### 7.9 Headings and the outline

The toolbar offers H2 and H3 while the construct audit verifies H1–H6 ([§10.2](#102-round-trip-invariants)) — an apparent contradiction that is actually a writer/reader split, now stated:

| Rule                           | Behaviour                                                                                                                                                                                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H1 is reserved**             | H1 is the item title and is set in the pane header, not the body. An H1 in the body — typed, pasted, or imported — is rejected by the construct audit as `HEADING_H1_RESERVED`, with a line number and the message _"Level 1 is the lesson title. Use level 2 for the first section."_ |
| **No skipped levels**          | Converting H3 → H4 when the preceding block is an H2 is a **no-op** with the tooltip _"Cannot skip a heading level."_ The same applies to the toolbar buttons and to the outline's level control. H2 may follow H2; H4 may follow H3.                                                  |
| **No skipped levels on paste** | A paste that would produce `## … #### …` is normalised down to the legal level rather than rejected — a pasted document is not the author's error, and a hard failure would make Word paste unusable.                                                                                  |

**Headings outline** — a dropdown in the canvas header, above the toolbar, listing every heading in document order with its level shown as a literal `H2`/`H3` prefix (never colour alone). Selecting an entry **moves the caret to that heading's start** and closes the dropdown. It is a single tab stop with `↑`/`↓` between entries, `Home`/`End` to the ends, `Enter` to jump, and `Esc` to close and return focus to the trigger. An empty lesson shows **"No headings yet"** ([S-7.3](09-Shared-Components.md#scr-7-3) variant), not an empty dropdown.

This is the **only** heading-navigation surface in v1: no outline sidebar, no collapsible section rail. A 40-heading lesson is navigable through the dropdown and `Ctrl/⌘ + F` ([§7.6](#76-find-replace-word-count-and-read-time)); a persistent outline is a Part 13 conversation, not a Revision 3 one.

---

## 8. Persistence & State

### 8.1 Autosave

[Part 11](11-Global-Standards.md#global-validation-and-feedback-patterns) mandates 60-second autosave in draft mode; this spec makes it concrete.

- **Timer:** 60s of _no typing_, not 60s wall-clock. A trailing debounce avoids saving mid-sentence.
- **Manual:** `Ctrl/⌘ + S` flushes immediately.
- **Dirty tracking:** derived from `editor.on('update')` _and_ the settings-pane `onChange`s, exactly as today — but `update` now also fires when Markdown and the rich doc diverge, so the same `dirty` flag covers both modes.
- **Save status indicator:** the shared [S-7.8](09-Shared-Components.md#scr-7-8) component, in its full variant in the pane footer and its compact variant in the pane header. Errors raise a toast ([S-7.2](09-Shared-Components.md#scr-7-2)) **and** leave the indicator in the failed state; the unsaved buffer is never discarded on failure. **Revision 2:** this document no longer specifies the indicator's appearance or its vocabulary — [S-7.8](09-Shared-Components.md#scr-7-8) is the single source for both, and `SaveStatus` maps onto it one-to-one.
  - **Correction (Revision 3).** Revision 2 described the indicator as a region "cycling `All changes saved` → `Saving…` → `All changes saved at HH:MM`". That is a **sequence, not a state machine**, and cycling it would double-announce every save. The indicator is now **one** live region owned by [S-7.8](09-Shared-Components.md#scr-7-8): `aria-live="polite"` for `idle` / `dirty` / `saving` / `saved`, `aria-live="assertive"` for `error` / `conflict` / `offline`. **Part 12 does not re-announce it** and must not render a second live region with the same text.
  - **What else this document announces,** so nothing is silent and nothing is doubled: a mode change announces _"Split view, source pane editable"_ on `polite`; removing a block announces _"Removed heading level 2: 'Introduction'"_ on `assertive` and moves focus to the **nearest surviving block's start position**, never to `document.body`; **adding a block announces nothing** — the caret position is the signal.
- **Context switching (new in Revision 2):** selecting another item, switching workspace tab, or navigating away **flushes first** ([S-7.8](09-Shared-Components.md#scr-7-8) rule 3). On failure the switch is blocked with Retry / Discard / Stay. This is the most important new behaviour for the workspace: the editor is now a pane inside a long-lived screen, so an unflushed buffer can survive many more navigations than it could when the editor was a page of its own.
- **Autosave is skipped** when the lesson is `in_review` (editing is locked, per S-2.7) and when the user is a Viewer/Reviewer (permission-aware UI, Part 11). The indicator shows _Autosave paused_ rather than disappearing, so the reason there is no save is visible.
- **On unmount / navigation:** the existing [S-7.1](09-Shared-Components.md#scr-7-1) confirmation dialog covers the unsaved case; Markdown does not change that behaviour.

#### 8.1.1 Draft mirroring and the unload guard

**The gap:** a 60s _no-typing_ timer means an author who types for 40 seconds and closes the tab has an **in-memory-only buffer**. [S-7.1](09-Shared-Components.md#scr-7-1) was _delegated_ for the unmount case but never specified for a closed tab, a crashed tab, or a device that dies. Three rules close it, and they implement the mirror [Part 04 S-2.7](04-Courses.md#scr-2-7) declares as the mechanism behind every session-expiry and reload guarantee:

1. **The unsaved body is mirrored to `IndexedDB`** on **every** `editor.update`, **debounced 1000 ms**, and **cleared on a confirmed save** — never on a failed or conflicted one. The mirror is the same Markdown string that would be sent, so restore is a `setContent(value, { contentType: 'markdown' })` and inherits the identical parse path ([D-8](#4-decisions), [§3.4](#34-ssr-hazard)).
2. **On mount**, if a local draft exists, the pane shows an [S-7.1](09-Shared-Components.md#scr-7-1) prompt — _"You have unsaved changes to this lesson from {time}. Restore them?"_ / **Discard** — **before hydrating**. The prompt is never silent and never auto-applied.
3. **`beforeunload` sets `preventDefault` whenever `dirty === true`**, regardless of the IndexedDB mirror. The mirror is the recovery path; the prompt is the cheap warning. `dirty` is false the moment a save is confirmed, so a saved lesson never prompts.

| Property        | Value                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Store / key** | `draft:item:<itemPublicId>:<rowVersion>` — identical to [Part 04 S-2.7](04-Courses.md#scr-2-7). The `rowVersion` in the key is what makes a stale draft impossible to confuse with a current one |
| **Payload**     | `{ body, title, updatedAt, rowVersion }` — no media bytes, no student data                                                                                                                       |
| **Cadence**     | **1000 ms debounce**, independent of the 60s server autosave                                                                                                                                     |
| **Cleared on**  | A **confirmed** server save only. A failed save leaves the mirror intact, because the work is not yet safe.                                                                                      |

> **Reconciled with Part 04's `rowVersion` clause.** Part 04 says both that a mirror whose `rowVersion` is _older_ than the server's raises the restore prompt, and that a key that no longer matches produces **Conflict** rather than a restore. Those two cannot both hold. The rule implemented here satisfies both intents:
>
> | Mirror `rowVersion` vs server | Result                                                                                                                           |
> | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
> | **≥ the server's**            | The draft is at least as new as the row — **restore prompt**, Restore or Discard                                                 |
> | **< the server's**            | The draft was based on an older row and cannot be applied without loss — **Conflict** ([§8.2](#82-concurrency)), never a restore |
> | **equal**                     | Redundant with a fresh save — discarded silently rather than prompting the author about a decision that has no consequence       |

#### 8.1.2 The autosave matrix

[Part 09 S-7.8](09-Shared-Components.md#scr-7-8) defines `offline` and Part 11 requires queued writes; Revision 2 listed every autosave condition and never mentioned either. The full matrix:

| `dirty` | Network | Locked?                                 | Save action                                                                                                                                                                                                                                                                                                                                                                                            | Indicator                                   | `expectedRowVersion`                         |
| ------- | ------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | -------------------------------------------- |
| `false` | online  | any                                     | none. `saved` timestamp retained; IndexedDB draft already cleared on the confirmed save that set it                                                                                                                                                                                                                                                                                                    | `idle` / `saved`                            | —                                            |
| `false` | offline | any                                     | none                                                                                                                                                                                                                                                                                                                                                                                                   | `offline` (banner persists)                 | —                                            |
| `true`  | online  | no, not in flight                       | flush at 60s idle, or immediately on `Ctrl/⌘ + S`                                                                                                                                                                                                                                                                                                                                                      | `dirty` → `saving` → `saved`                | **sent** — stamped from the last server read |
| `true`  | online  | no, save in flight                      | in flight; further edits re-arm the 60s timer and set `dirty` again                                                                                                                                                                                                                                                                                                                                    | `saving`                                    | sent, once                                   |
| `true`  | online  | no, last save failed                    | **no** auto-retry after a `4xx` or a conflict — the user resolves it. Transient `5xx` retries with backoff (1s / 4s / 15s), then stops                                                                                                                                                                                                                                                                 | `error` — _Save failed — Retry_             | **held** — not re-stamped on retry           |
| `true`  | online  | **yes** (`in_review`, Viewer, Reviewer) | **no save at all.** The buffer is mirrored to IndexedDB and left there; autosave is suspended, not discarded                                                                                                                                                                                                                                                                                           | `suspended` — _Autosave paused (in review)_ | **held** — never sent while locked           |
| `true`  | offline | no                                      | **enqueue** `{ body, bodyFormat, expectedRowVersion, queuedAt }`, in order. **The canvas stays editable** — [Part 04 S-2.7](04-Courses.md#scr-2-7) is explicit that offline authoring is safe, because the mirror keeps taking writes every 1000 ms. The banner reads _"You're offline — 4 changes will sync when you reconnect."_ and `Flush now` reads **"Queued — will sync"** rather than erroring | `offline`                                   | **held**, and **carried in the queue**       |
| `true`  | offline | **yes**                                 | mirror to IndexedDB only; **not** enqueued (a locked row has no server to accept it)                                                                                                                                                                                                                                                                                                                   | `offline` + _Autosave paused_               | held                                         |

> **Offline is editable here, unlike most surfaces.** [Part 11 § Resilience](11-Global-Standards.md#resilience-states) renders an offline surface read-only, but the item pane is the documented exception ([Part 04 S-2.7](04-Courses.md#scr-2-7)): because the body is a local buffer with a 1000 ms mirror, locking the author out would protect nothing and cost the whole session. What is suspended offline is the **server write path**, not the editor.

**Queue semantics on reconnect:** queued writes flush **in order**. A queued write whose `rowVersion` is now stale resolves to **conflict** ([§8.2](#82-concurrency)) — **never a silent overwrite** ([Part 11 § Resilience](11-Global-Standards.md#resilience-states)). Subsequent queued writes for the same lesson are **not** discarded: they are held behind the conflict resolution and re-stamped by whichever option the author picks, so _"Keep mine"_ recovers the whole queue rather than only its head.

**Advisory checks never block autosave.** A reference-audit advisory ([§9.4](#94-reference-audit)) or a `lang` advisory ([§7.4](#74-accessibility)) surfaces in readiness and **not** in the save path. Only `ValidationError` from the construct audit ([§9.3](#93-server-side-validation)) and a `409` stop a write.

### 8.2 Concurrency

Unchanged and re-stated so the Markdown work does not regress it: `expectedRowVersion` is sent on every write; a mismatch is rejected server-side. On a `409`/version conflict the editor **must not** silently overwrite and **must not** attempt an automatic Markdown merge.

**Revision 3 — Reload is no longer the only option.** Offering only Reload destroys up to 60s of unsaved typing and contradicts `DESIGN.md` §12; "Reload" is a destructive action wearing a neutral label. The conflict surface is [S-7.1](09-Shared-Components.md#scr-7-1) with the Part 11 conflict vocabulary, and it matches the **Row Conflict** state in [Part 04 S-2.7](04-Courses.md#scr-2-7) exactly:

| Option                                                       | Behaviour                                                                                                                                                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **The two-column Markdown diff** — the dialog's default view | _Yours_ on the left, _Theirs_ on the right, changed lines highlighted, **both sides collapsible to a context window**. Read-only: no merge, no edit, no save. This is what makes the other two options safe.                                           |
| **Keep mine** _(default)_                                    | Re-fetch the server row, **re-stamp `expectedRowVersion` to the server value**, retry the save **once**, and log the override (actor, lesson, both `rowVersion`s, timestamp) to the audit log. A second `409` re-opens the dialog rather than looping. |
| **Take theirs**                                              | Discard the local buffer, hydrate the server body, and clear the IndexedDB draft ([§8.1.1](#811-draft-mirroring-and-the-unload-guard)). This is the **renamed Reload**; destructive, so it is the **last** option and requires confirmation.           |
| **Compare**                                                  | Opens the two bodies side by side in a **full-width overlay** — the same content as the default diff, at a size where a 5,000-word change is actually reviewable.                                                                                      |

**Merge remains out of scope** ([§1.2](#12-non-goals)) — an automatic three-way Markdown merge is a separate and much larger piece of work. **Discarding the author's work is not**: the author's buffer is always reachable, either through **Compare** before deciding or through the `body_revisions` table after the fact ([§14.1](#141-version-history-minimal-not-git)).

**In the workspace, a conflict additionally re-renders the curriculum tree row** ([§16.4](#164-save-state-and-concurrency)) so the author can see the item moved, changed status, or was archived by someone else. The queued-offline-write case resolves here too, on the same three options ([§8.1.2](#812-the-autosave-matrix)).

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

### 9.4 Reference audit

[§9.3](#93-server-side-validation) checks whether a construct is **representable**. It says nothing about whether the construct still **resolves** — an image whose library asset was deleted, or a link to a page that 404s, passes every construct check and reaches students broken. Revision 2 had no detection at all; discovery was a support ticket.

| Reference type | Check                                                                                                                   | Cache / cost                                                                                                | Code               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------ |
| **Image URL**  | `HEAD` against the **library asset table** (a DB lookup, not the CDN) — a 200 in the asset table means the asset exists | No network call. One indexed query per distinct asset id                                                    | `ASSET_MISSING`    |
| **Link host**  | `HEAD` against the origin, cached per host + path-prefix                                                                | **24h TTL** per host. Negative results cached for **1h** so a dead host is not re-probed on every keystroke | `LINK_UNREACHABLE` |

Both are **advisory** [S-7.11](09-Shared-Components.md#scr-7-11) rows, never `ValidationError`:

- They are emitted as rows in the **readiness checklist**, grouped under advisory, with a **Fix** deep link that **selects the node and focuses the relevant dialog** — the link dialog for `LINK_UNREACHABLE`, the image's alt-text/asset field for `ASSET_MISSING` — per Part 11's rule that a `Fix` link moves focus to the offending field.
- An advisory **never blocks autosave** ([§8.1.2](#812-the-autosave-matrix)) and never produces a `409`. It **does** block publish readiness, because a broken image in a Published lesson is a student-facing defect.
- A **Content Library** asset that is merely archived is `ASSET_MISSING` with the message _"This image is in the library's archive — restore it or choose another."_, and a **Fix** action that opens the asset. An asset that is present in the table but failing its CDN `HEAD` is a distinct message so the author knows it is a delivery problem, not a missing file.
- The audit runs on **flush** (`Ctrl/⌘ + S`, context switch, and the 60s idle timer) and on **publish-readiness re-check** — never per keystroke. The 24h link cache is what makes this affordable.

> **Skipped checks, and why.** `RC-4a` / `RC-4b` / `RC-4c` apply to the **base variant only**, per [Part 04 S-2.7](04-Courses.md#scr-2-7). A **translation variant with no source text yet** — a translation the course declares in `content_language` but has not authored — is reported as an **advisory**, never a blocking check, and the checklist row states the skip rather than showing a pass: _"RC-4 skipped — no source text for this translation."_ A readiness check that reports a pass it did not perform is worse than a visible skip. Translating a lesson must never un-publish a course.

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

### 11.1 AI-authored body content (explicitly bounded)

[§1.2](#12-non-goals) disclaimed an AI authoring surface while this document still referred to the ✨ rules as though they applied. The boundary is now explicit and narrow: **AI may propose body text at the author's request; it may never write it.**

**Presentation.** Generated content arrives as an **`AIDraftBlock` range** — a contiguous span of the doc carrying:

| Element    | Value                                                                              |
| ---------- | ---------------------------------------------------------------------------------- |
| Border     | **1px dashed** `--color-ai-text` — dashed, so it is distinguishable without colour |
| Background | `--color-ai-tint`                                                                  |
| Icon       | ✨ (hugeicons, never an emoji)                                                     |
| Label      | The literal text **"AI draft"** — never hue alone                                  |
| Actions    | **Accept all** · **Accept selection** · **Discard**                                |

**The rules that make it safe:**

- **Accept is what writes into `lessons.body`.** Generation output lives in **local state only** and is **never autosaved** — an unaccepted draft cannot be flushed by the 60s timer, by `Ctrl/⌘ + S`, by a context switch, or by the IndexedDB mirror ([§8.1.1](#811-draft-mirroring-and-the-unload-guard)). A draft is not content; it is a proposal.
- **Accept all** converts the whole `AIDraftBlock` to normal nodes. **Accept selection** converts only the selected range to normal nodes and leaves the remainder a draft, so partial acceptance is the normal case rather than an edge case. **Discard** removes the range and is reversible with `Ctrl/⌘ + Z`.
- **Regenerate is explicitly scoped**, and the scope is in the **button label** — never implied by a menu's current state: _Regenerate this block_ · _Regenerate this section_ · _Regenerate whole lesson_. A whole-lesson regeneration replaces the current draft and requires confirmation, because it is the one scope that can discard accepted-looking work.
- **On Accept, a `body_revisions` row is written with reason `ai_accept`** ([§14.1](#141-version-history-minimal-not-git)), so AI-accepted text is reviewable after the fact and distinguishable from hand-written text. The `AIDraftBlock` metadata does **not** survive into `lessons.body` — the persisted body is plain authored Markdown.
- **The source pane never shows AI-accepted text as hand-written.** An unaccepted draft renders in the source pane as the literal marker `<!-- ai-draft:unaccepted -->` at the draft's position, so switching to Source or Split is never a way to launder generated text into something that looks authored. On **Accept**, the marker is replaced by the real Markdown.

> **Why the source pane is the last line of defence.** A rich-only marker disappears the moment the author switches panes, and Markdown that looks hand-written in Source is the exact failure `DESIGN.md`'s human-in-the-loop principle exists to prevent. The comment costs one line of Markdown, is inert to the renderer (`streamdown` with HTML disabled), and survives a copy-paste out of the pane.

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
| 5.5  | **Rollout gate.**                                                                                                                 | See below.                                                     |
| 6    | Read path: `bodyFormat` on the DTO + dual hydration in the editor.                                                                | Legacy HTML lessons still open and save unchanged.             |
| 7    | `courses.legacy-html.ts` + migration script + run report.                                                                         | Report produced; unconvertible rows listed, not guessed.       |
| 8    | Autosave hook, view modes, toolbar rewrite, keyboard map, `validateLessonMarkdown`.                                               | A11y checks pass; `Ctrl/⌘+K` unblocked.                        |
| 9    | Migrate production data; re-run report until `skipped (unconvertible): 0` or every remainder is triaged.                          | Zero unexplained skips.                                        |

Steps 4–6 ship **before** 7, so a rollback never leaves a schema without a reader.

### 12.0 The rollout gate (step 5.5)

> **Correction (Revision 3).** The header claimed "each step is independently shippable and reversible", but step 5 makes Markdown the **write** format while step 7 is what makes the **data** Markdown. A deploy-revert between 5 and 7 leaves rows stamped `body_format = 'markdown'` that the old reader would have to sniff — and [D-4](#4-decisions) already established that sniffing is unreliable. So the plan's reversibility claim was false in exactly the window that matters.
>
> **Step 5 is gated behind a `markdownWritesEnabled` workspace flag.** Rollback is **flag-off, not deploy-revert**, so a partial rollout never leaves rows the reader cannot parse: with the flag off, `saveLesson` stamps the legacy format and dual hydration ([§5.2](#52-read-path)) keeps every row readable regardless of which side of step 5/7 the workspace is on. The flag is read server-side from the workspace record, defaults **off**, and is enabled per workspace so a pilot can run for a week before the fleet moves.

**Flag-state matrix:**

| `markdownWritesEnabled`  | Data state                     | Reader                                 | Writer            | Rollback                                                                                                                                             |
| ------------------------ | ------------------------------ | -------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `off` (default)          | any mix of `html` / `markdown` | dual hydration ([§5.2](#52-read-path)) | writes `html`     | no-op                                                                                                                                                |
| `on`, step 7 not yet run | mostly `html`                  | dual hydration                         | writes `markdown` | **flag off** → rows revert to being read as HTML; no migration is un-done                                                                            |
| `on`, step 7 run         | mostly `markdown`              | Markdown path                          | writes `markdown` | **flag off** → writes `html` again, which the [§5.3](#53-migration) table can convert back losslessly; `body_format` keeps the row honest either way |

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

### 12.2 Success Criteria & Instrumentation

Added in Revision 3 to match the [Part 11 § Success Criteria & Instrumentation](11-Global-Standards.md#success-criteria--instrumentation) format every screen now carries.

**Performance budgets:**

| Budget                               | Target                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Hydration of a 200k-character lesson | parse → doc → first paint **< 1.5 s** on a mid-tier laptop over 4G                                                     |
| Rich → Source sync                   | **≤ 50 ms** at 50k characters                                                                                          |
| Keystroke                            | **never blocks the main thread > 16 ms** — a single frame budget, asserted with a long-task observer                   |
| Find/replace over a 200k body        | first match in **< 100 ms** after the 300 ms announce debounce                                                         |
| Editor bundle                        | **route-level code-split** — Tiptap is not in the workspace shell's chunk and is not fetched until an item pane mounts |

These are the **implementation-side** budgets. [Part 04 S-2.7](04-Courses.md#scr-2-7) states the same three figures as the screen budget; they are one set of numbers recorded in two places, not two targets.

**Acceptance criteria** (binary; a tester can fail each one):

1. `axe` reports **zero** violations on Rich, Split, and Source, including at 200% zoom.
2. A complete keyboard path — tree → item pane → type → `Ctrl/⌘+S` → switch mode → back to the tree — completes with **no mouse**, and the tree's selection and scroll position are intact on return.
3. **NVDA and VoiceOver** pass on all three modes: the toolbar reports group and pressed state, the source textarea is labelled, find reports _"n of N matches"_, and a conflict is announced `assertive`.
4. At **200% zoom** and at a **320px** viewport, the editor reflows with **no horizontal page scroll**; a table wider than the pane scrolls inside its own labelled region.
5. A **10-minute Ge'ez lesson** renders with **zero fixed-height truncation** — no `line-clamp`, no clipped glyph at `line-height: 1.6`, and no truncation on the source pane.
6. Closing the tab with unsaved changes, then reopening the same lesson, presents the **"Restore unsaved draft from {time}?"** prompt with a working Discard ([§8.1.1](#811-draft-mirroring-and-the-unload-guard)).
7. Going offline, editing, and reconnecting with a server-side change in between resolves to the **three-option conflict dialog** — never a silent overwrite ([§8.2](#82-concurrency)).

**Events.** Every property is an ID, a count, or an enum. **No body content, no prompt text, no PII** — including no URLs and no filenames.

| Event                                  | Properties                                                                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `lesson_editor_mode_switched`          | `{ courseId, lessonId, bodyFormat, mode }`                                                                                                     |
| `lesson_editor_sync_failed`            | `{ courseId, lessonId, bodyFormat, direction, code }` — `direction` ∈ `rich→source` \| `source→rich`; `code` is the audit code, never the text |
| `lesson_editor_construct_audit_failed` | `{ courseId, lessonId, bodyFormat, code, count }`                                                                                              |
| `lesson_editor_paste_sanitized`        | `{ courseId, lessonId, bodyFormat, rule, count }` — `rule` names which [§7.8](#78-paste-sanitisation) rule fired                               |
| `lesson_editor_conflict_shown`         | `{ courseId, lessonId, bodyFormat, resolution }` — `resolution` ∈ `compare` \| `keep_mine` \| `take_theirs`                                    |
| `lesson_editor_ai_block_accepted`      | `{ courseId, lessonId, bodyFormat, scope, characters }` — `scope` ∈ `block` \| `selection` \| `all`                                            |
| `lesson_editor_export`                 | `{ courseId, lessonId, bodyFormat, format }`                                                                                                   |
| `lesson_editor_draft_restored`         | `{ courseId, lessonId, bodyFormat, source }` — `source` ∈ `idb` \| `undo`; **no** draft content                                                |

> **Reconciled with [Part 04 S-2.7](04-Courses.md#scr-2-7)'s event set**, which already fires `item_editor_opened`, `item_body_flushed`, `item_draft_mirrored`, `item_conflict_shown`, `item_publish_toggled`, and `translation_variant_opened`. Three overlaps, resolved so nothing is counted twice:
>
> | Overlap                                                  | Resolution                                                                                                                                                   |
> | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
> | `lesson_editor_draft_restored` vs `item_draft_mirrored`  | **Two different facts.** `item_draft_mirrored` is the 1000 ms write; `lesson_editor_draft_restored` is the author choosing Restore. Keep both.               |
> | `lesson_editor_conflict_shown` vs `item_conflict_shown`  | **One event.** The Part 04 name wins; `{ itemId, strategy }` is extended with `{ courseId, bodyFormat }`. `lesson_editor_conflict_shown` is **not** emitted. |
> | `lesson_editor_mode_switched` vs `workspace_tab_changed` | Unrelated surfaces. Both stand.                                                                                                                              |

---

## 13. Risks & Mitigations

| Risk                                                                         | Impact                                                      | Mitigation                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An extension is dropped from the list later, silently re-enabling lossiness. | Silent data loss on the next save.                          | Fixture corpus pinned in `courses.markdown.test.ts` fails loudly on removal.                                                                                                                                                                                                                                                             |
| HTML injection through raw Markdown.                                         | Stored XSS rendered to students.                            | Student render path uses `streamdown` with HTML disabled; the editor never accepts raw HTML nodes; `Image.allowBase64: false`.                                                                                                                                                                                                           |
| Un-migrated lessons edited by a new client write Markdown over HTML rows.    | Mixed formats in one course.                                | `bodyFormat` on the DTO plus dual hydration; save path stamps `'markdown'`, making the transition self-completing per row.                                                                                                                                                                                                               |
| Split mode confuses authors or breaks Undo.                                  | Poor adoption.                                              | Rich is the default; Split is opt-in and labelled a precision mode; the Undo caveat is documented in the UI.                                                                                                                                                                                                                             |
| `marked` behaves differently in future minor bumps.                          | Parse drift.                                                | `@tiptap/markdown` pins `marked` internally; round-trip tests fail loudly on drift rather than corrupting silently.                                                                                                                                                                                                                      |
| Dual markdown in the body breaks the 200k cap sooner than HTML.              | Save rejections on large lessons.                           | Cap is unchanged at 200k; normalization runs first, and the error message reports actual vs. limit.                                                                                                                                                                                                                                      |
| An author edits offline and reconnects after a server-side change.           | A silent overwrite of a colleague's edit, or a lost buffer. | Writes queue in order carrying the `rowVersion` they were based on; a stale queued write resolves to the **three-option conflict dialog**, never a silent overwrite ([§8.1.2](#812-the-autosave-matrix), [§8.2](#82-concurrency)). The buffer is mirrored to IndexedDB regardless ([§8.1.1](#811-draft-mirroring-and-the-unload-guard)). |

---

## 14. Out of Scope

Deferred deliberately, with the reason:

- **Collaborative editing / CRDT merge** — the `rowVersion` guard is the current model; a merge UI is a separate, much larger piece of work. Note that **Compare** in the conflict dialog ([§8.2](#82-concurrency)) is a read-only diff, not a merge.
- **Git-style revision history and diff view** — the _full_ feature (branching, commit messages authored by users, blame, arbitrary comparison between any two points) remains deferred; it is a future spec. The **minimum** a reviewer needs to do their job — review a _change_ — is specified in [§14.1](#141-version-history-minimal-not-git), and Markdown is a _prerequisite_ for readable diffs, which is part of why D-3 is worth the migration.
- **AI _generating_ Markdown autonomously** — [§1.2](#12-non-goals). Explicit, human-accepted insertion is [§11.1](#111-ai-authored-body-content-explicitly-bounded).
- **LaTeX / math nodes** — common in language courses. Requires a custom node with a `parseMarkdown`/`renderMarkdown` spec; the `@tiptap/core` `markdown` namespace ([§3.1](#31-the-installed-editor-cannot-emit-markdown-out-of-the-box)) exists precisely for that, and it is a good first candidate once this spec lands.
- **Custom shortcode embeds** (e.g. `{{quiz:abc}}`) — same mechanism, later.
- **Per-user source-pane syntax highlighting** — the pane is a plain `<textarea>` for accessibility ([§7.4](#74-accessibility)); a CodeMirror instance would replace it and needs its own a11y review.
- **A general HTML→GFM table converter for pasted web tables** — only spreadsheet TSV converts ([§7.8](#78-paste-sanitisation)). A general converter is a data-loss surface with no round-trip guarantee.
- **A persistent heading outline / section rail** — the dropdown in [§7.9](#79-headings-and-the-outline) plus find/replace ([§7.6](#76-find-replace-word-count-and-read-time)) are the v1 navigation surface.
- **Print / PDF export of a lesson body** — out of scope for v1, stated explicitly here and in the preview parity table ([§16.3](#163-preview-reuses-the-render-path-not-the-editor)) so nobody builds a print stylesheet for an editor that never had one.

### 14.1 Version history (minimal, not Git)

[§14](#14-out-of-scope) deferred revision history entirely, which breaks the reviewer's job: [S-2.14](04-Courses.md#scr-2-14) asks a reviewer to judge a change, and with no prior version there is nothing to change _from_. This is the minimum that satisfies `DESIGN.md` §5.10 — **without** building Git.

**Storage** — one append-only table in `packages/database/src/schema/catalog/`:

```ts
export const lessonBodyRevisionReasonPgEnum = pgEnum('lesson_body_revision_reason', [
  'save', // explicit Flush now
  'ai_accept', // §11.1
  'restore', // §14.1 restore action
  'migration', // §5.3 HTML → Markdown
])

export const lessonBodyRevisions = pgTable('lessons_body_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  lessonId: uuid('lesson_id')
    .notNull()
    .references(() => lessons.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  bodyFormat: lessonBodyFormatPgEnum().notNull(),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  reason: lessonBodyRevisionReasonPgEnum().notNull(),
})
```

**When a revision is written — and when it is not:**

| Event                                   | Writes a revision?   | Why                                                                                                                                                                                                                            |
| --------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Explicit `Flush now`** (`Ctrl/⌘ + S`) | **Yes**, `save`      | The author declared this a save point                                                                                                                                                                                          |
| **Submit for review**                   | **Yes**, `save`      | The reviewer needs a baseline at exactly the moment of the decision ([S-2.14](04-Courses.md#scr-2-14))                                                                                                                         |
| **AI Accept**                           | **Yes**, `ai_accept` | [§11.1](#111-ai-authored-body-content-explicitly-bounded)                                                                                                                                                                      |
| **Restore a previous version**          | **Yes**, `restore`   | Restoring **appends**; it never deletes or truncates history                                                                                                                                                                   |
| **§5.3 migration**                      | **Yes**, `migration` | Keeps the pre-migration HTML comparable to the Markdown                                                                                                                                                                        |
| **The 60s autosave timer**              | **No**               | An autosave every 60s would make the history unreadable and unbounded. The autosave path is covered by the [S-7.1](09-Shared-Components.md#scr-7-1) draft mirror instead ([§8.1.1](#811-draft-mirroring-and-the-unload-guard)) |
| **Context switch / unmount flush**      | **No**               | Same reason — it is a transport event, not a declared save point                                                                                                                                                               |

> **Why the autosave gap is acceptable:** the history answers "what changed for review", and a review happens at submit-for-review, which is a revision. The gap between two revisions is the author's own work in progress, and losing it costs one autosave cycle, not work. Retention is 30 revisions per lesson with a documented prune job; the row count is bounded regardless of how often the buffer flushes.

**The [S-2.14](04-Courses.md#scr-2-14) review panel** lists revisions newest-first with:

- Created-by, timestamp (`Africa/Addis_Ababa` with the offset in a tooltip, per Part 11), and the reason as a pill using the [Part 11 status mapping](11-Global-Standards.md#status-colour-mapping) — `ai_accept` on `--color-ai-text` / `--color-ai-tint` with the ✨ icon, so AI-accepted text is identifiable at a glance.
- A **line-count delta** per revision (_"+42 / −7"_) so the reviewer sees the shape of the change before opening it.
- An **optional unified diff view**, rendered **read-only** — no inline editing, no merge, no comment anchors. It is a reading tool.
- **Restore this version**, which opens [S-7.1](09-Shared-Components.md#scr-7-1) for confirmation and then writes a **new** `restore` revision. History is append-only: there is no delete, no truncate, and no "revert to here and lose the rest".

---

## 15. Open Questions

| #   | Question                                                                                                                                                                                                                                                                                                                                                                                                                   | Owner        | Blocks |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------ |
| Q-1 | Should the source pane be a `<textarea>` (chosen, a11y-first) or a CodeMirror 6 instance with a documented a11y layer?                                                                                                                                                                                                                                                                                                     | Design + Eng | Step 8 |
| Q-2 | Do instructors need fenced math in lessons? If yes it becomes the first custom `parseMarkdown`/`renderMarkdown` node.                                                                                                                                                                                                                                                                                                      | Curriculum   | §14    |
| Q-3 | Is per-lesson Markdown export ([§9.1](#91-server-functions)) needed for the Content Library, or is lesson body export sufficient?                                                                                                                                                                                                                                                                                          | Product      | Step 8 |
| Q-4 | Should the reviewer queue deep-link straight into Preview mode? ([§11](#11-review-workflow-integration))                                                                                                                                                                                                                                                                                                                   | Product      | Step 8 |
| Q-5 | ~~Do `01`-`11` UX specs need updating to mention the three view modes?~~ **Answered in Revision 2 — yes.** [Part 04](04-Courses.md#scr-2-7) and [Part 11](11-Global-Standards.md#reusable-component-library) now describe the three view modes as the item pane's _Content_ sub-tab, and the mode switch is documented as a `role="tablist"` presentation concern. No further UX spec change is needed for the view modes. |
| Q-6 | **New in Revision 2.** When an item is selected in the curriculum tree, should its body load eagerly or only on pane focus? Eager is simpler and matches the current single-item load; lazy is cheaper for a 100-item course. Recommendation: **eager for the selected item only**, which is what the tree-plus-pane model already implies.                                                                                | Eng          | Step 8 |
| Q-7 | **New in Revision 2.** Should the curriculum tree hold the item _bodies_ so cross-section moves never round-trip? Recommendation: **no** — that would duplicate `lessons.body` and violate [G-5](#11-goals). Structural moves touch `sort_order` and `module_id` only.                                                                                                                                                     | Eng          | §16.2  |

---

## 16. Revision 2 — Workspace Integration

Added by the Course Workspace redesign. **This section adds hosting and interaction rules only.** The Markdown content model, storage format, extension list, normalization, and round-trip invariants in [§5](#5-storage-model)–[§10](#10-normalization--invariants) are unchanged and remain authoritative.

### 16.1 One editor, two hosts

The editor has exactly one implementation and two hosts:

| Host                               | Route                                                  | Behaviour                                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Curriculum item pane (primary)** | `/_app/courses/$courseId?tab=curriculum&item=<itemId>` | Renders beside the persistent [S-7.9 Curriculum Tree](09-Shared-Components.md#scr-7-9). Selection lives in the URL, so the pane is linkable and the browser Back button moves between items.                   |
| **Alias route (compatibility)**    | `/_app/courses/$courseId/lessons/$lessonId`            | Redirects to the workspace URL above. It exists for search results, notifications, and the Content Library _Used in_ list. **It must not mount a second editor, a second toolbar, or a second autosave loop.** |

The pre-Revision-2 route's `requireRolesBeforeLoad(['admin','editor'])` is replaced by the workspace route's guard plus permission-aware rendering. A Reviewer and a Viewer can therefore open the same URL as an Editor and see a read-only pane — which is what makes the [S-2.14](04-Courses.md#scr-2-14) review experience possible without a separate screen.

### 16.2 Mount and unmount lifecycle inside a long-lived pane

Because the pane lives inside a screen that stays mounted while the author switches items, the editor's lifecycle is now driven by the selected item rather than by the route:

- On `item` change, the previous editor is **destroyed** and a new one constructed for the new item, after the flush described in [§8.1](#81-autosave). Destroying rather than reusing the instance is deliberate: a ProseMirror document belongs to one item, and reusing the instance would risk writing item A's buffer into item B.
- Hydration still happens **after mount** ([D-8](#4-decisions), [§3.4](#34-ssr-hazard)), and the pane's skeleton replaces **only the pane** — the tree keeps its selection and scroll position.
- Structural changes (rename, move, archive) come from the tree while the editor is mounted. The editor subscribes to the curriculum query and updates its **header** (title, breadcrumb, badges) from the server's authoritative tree; it must never assume its own copy of the item's position.
- An item archived or deleted while its editor is open replaces the canvas with an explicit banner ([S-2.7](04-Courses.md#scr-2-7)), not a save attempt.

### 16.3 Preview reuses the render path, not the editor

[S-2.21 Learner Preview](04-Courses.md#scr-2-21) and the editor's **Preview** view mode must render the same Markdown through the same pipeline (`streamdown`, HTML disabled, [§13](#13-risks--mitigations)), differing only in chrome. Two render paths for the same body is how a preview comes to disagree with production, which defeats the purpose of previewing at all. **Any change to the student-facing renderer must be reflected in both**, and the round-trip fixtures in [§12.1](#121-testing) are the shared guard.

#### 16.3.1 Preview parity

Revision 2 asserted parity and stopped. Parity is a claim about **every** surface difference, so each one is named with its required behaviour:

| Surface                          | Required behaviour in the editor's Preview mode                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Body Markdown**                | **Identical.** Same `streamdown` render, same HTML-disabled configuration, same normalization ([§10.1](#101-normalization)) as the student view. No editor-only wrapper, no placeholder, no "click to edit" affordance inside the body.                                                                                                                                                    |
| **Title, duration, tags**        | Rendered from the same fields the student header reads, at student-header styling. The editor's own title field is the source, so a stale header is a visible defect, not a nuance.                                                                                                                                                                                                        |
| **Attached quiz**                | **Not shown** in the editor preview, with a link reading **"Opens after the lesson body"**. An author cannot answer their own quiz from the body pane, and pretending otherwise invites them to grade against the wrong thing.                                                                                                                                                             |
| **Media + captions**             | Video and audio render; the **transcript link is visible** ([S-3.6](05-Content-Library.md#scr-3-6)) so the author can confirm captions exist. A video with no captions shows the `RC-5` blocking state, not a silent player.                                                                                                                                                               |
| **Unlock rules / prerequisites** | A banner: **"Gated — students must complete {X}."** Rules come from [S-2.15](04-Courses.md#scr-2-15), evaluated the same way the player evaluates them. A gated lesson previewed by its own author is the single most common way an author misses a misconfigured prerequisite.                                                                                                            |
| **Availability window**          | A banner when now is **outside** the window: _"Available {date} – {date}."_ Inside the window, no banner. Times per Part 11: `6:00 PM EAT`, never a bare date.                                                                                                                                                                                                                             |
| **Tenant branding**              | **Applied** — logo, colours, and fonts resolve to the tenant's values, so an author sees what a student of that workspace sees. Branding still may not override `--color-*-text`, `--color-*-tint`, the focus ring, or `--color-danger-*` (Part 11).                                                                                                                                       |
| **Device frame**                 | **Preview mode renders inside the [S-2.21 Preview Frame](04-Courses.md#scr-2-21)** — desktop by default, tablet/mobile switchable. The frame is a labelled region, not a resized page. **Rich and Split never resize the workspace behind them**: switching to Rich or Split restores the pane to full width with no leftover frame, no scroll trap, and no reflow of the curriculum tree. |
| **Print / PDF**                  | **Out of scope for v1**, stated explicitly rather than left ambiguous. No print stylesheet is built for the editor. The audit log and exports still use absolute ISO-8601 with offset (Part 11) — a different requirement, still honoured.                                                                                                                                                 |

> **The frame is the point.** A preview that reflows the workspace behind it cannot be compared against the previous preview, and the author loses the tree they were navigating. The frame is a fixed-width container; the editor's own modes use the pane's full width.

### 16.4 Save state and concurrency

- The editor's `SaveStatus` maps one-to-one onto the shared [S-7.8](09-Shared-Components.md#scr-7-8) state machine; this document no longer owns the vocabulary.
- The `expectedRowVersion` guard ([§8.2](#82-concurrency)) is unchanged. In the workspace, a conflict additionally re-renders the **tree row**, so the author can see that the item moved, changed status, or was archived by someone else.
- Autosave is suspended — and the indicator says _Autosave paused (in review)_ — exactly as specified in [§8.1](#81-autosave) and [§11](#11-review-workflow-integration).

### 16.5 Unchanged by this revision

Restated explicitly, because the temptation on a large UX change is to assume the content model moved with it:

- `lessons.body` + `lessons.body_format` remain the single source of truth ([D-3](#4-decisions), [G-5](#11-goals)).
- The `LESSON_EDITOR_EXTENSIONS` list, its ordering ([D-6](#4-decisions)), and the `bodyFormat: z.literal('markdown')` boundary check are untouched.
- `MarkdownManager` DOM-free usage for server-side validation and migration is untouched ([§9.3](#93-server-side-validation)).
- The RT1–RT5 invariants and their fixture corpus are untouched — and they now additionally protect the _preview_ renderer, per [§16.3](#163-preview-reuses-the-render-path-not-the-editor).
- The HTML→Markdown migration plan and its run report are untouched; the curriculum reorganisation does not affect the body of any lesson.

> **Restated for Revision 3**, since the temptation recurs: [§5](#5-storage-model) (`body` + `body_format` as the single source of truth), [§5.4](#54-write-path) (`bodyFormat: z.literal('markdown')` at the boundary), [§10.1](#101-normalization), and **RT1–RT5** are all **unchanged**. Revision 3 adds _around_ the content model — durability, conflict resolution, media handling, keyboard paths, type rules, and instrumentation — and introduces exactly **one** new table (`lessons.body_revisions`, [§14.1](#141-version-history-minimal-not-git)), which is append-only and is never read by the render path.

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

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Author |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 2026-09-28 | Initial specification. Toolchain findings verified empirically against Tiptap 3.31.3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | —      |
| 2026-09-28 | **Revision 2 — Course Workspace.** Adds [§16](#16-revision-2--workspace-integration); updates [§8.1](#81-autosave) and [§15](#15-open-questions). Content model, storage contract, extension list, normalization, and RT1–RT5 **unchanged**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | —      |
| 2026-09-29 | **Revision 3 — Editor completeness.** Adds [§7.5](#75-image-insertion)–[§7.9](#79-headings-and-the-outline) (image insertion, find/replace + read time, tables & code blocks, paste sanitisation, headings & outline), [§8.1.1](#811-draft-mirroring-and-the-unload-guard), [§8.1.2](#812-the-autosave-matrix), [§9.4](#94-reference-audit), [§11.1](#111-ai-authored-body-content-explicitly-bounded), [§12.0](#120-the-rollout-gate-step-55), [§12.2](#122-success-criteria--instrumentation), [§14.1](#141-version-history-minimal-not-git), [§16.3.1](#1631-preview-parity); revises [§1.2](#12-non-goals), [§4](#4-decisions) (D-9), [§6.1](#61-the-extension-list), [§7.1](#71-view-modes)–[§7.4](#74-accessibility), [§8.2](#82-concurrency), [§12](#12-implementation-plan), [§13](#13-risks--mitigations), [§14](#14-out-of-scope). **§5 storage model, §10 normalization, and RT1–RT5 unchanged.** | —      |
