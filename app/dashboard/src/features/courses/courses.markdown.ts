/**
 * Markdown core for the Lesson Editor — spec 12 § 10 ("Normalization &
 * Invariants") and § 3.3 ("Lossy-construct audit").
 *
 * Pure and DOM-free by design: `MarkdownManager.parse` / `.serialize` need no
 * `window`, so the same functions run in the browser, in `bun test`, and inside
 * server functions. That is what makes server-side validation (spec 12 § 9.3)
 * and the HTML→Markdown migration (§ 5.3) possible at all.
 *
 * Structural doc types are declared locally instead of importing
 * `JSONContent` from `@tiptap/core`, which is only a transitive dependency;
 * the local shape is structurally compatible with the editor's JSON.
 */
import { MarkdownManager } from '@tiptap/markdown'
import { LESSON_EDITOR_EXTENSIONS } from './courses.markdown-extensions'

/** A ProseMirror document as produced by `MarkdownManager.parse`. */
export interface DocNode {
  type: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
}

let cachedManager: MarkdownManager | null = null

/** The one `MarkdownManager` instance, built from the editor's own extensions. */
export function lessonMarkdownManager(): MarkdownManager {
  cachedManager ??= new MarkdownManager({ extensions: LESSON_EDITOR_EXTENSIONS })
  return cachedManager
}

/* -------------------------------------------------------------------------- */
/* Parse / serialize                                                          */
/* -------------------------------------------------------------------------- */

/** Parse a Markdown string into a document. Never throws on unknown syntax. */
export function markdownToDoc(markdown: string): DocNode {
  return lessonMarkdownManager().parse(markdown) as DocNode
}

/** Serialize a document to Markdown (unnormalized). */
export function docToMarkdown(doc: DocNode): string {
  return lessonMarkdownManager().serialize(doc)
}

/* -------------------------------------------------------------------------- */
/* Normalization — spec 12 § 10.1                                             */
/* -------------------------------------------------------------------------- */

/**
 * Collapse cosmetic churn so a stable document never reads as "dirty".
 *
 * Deliberately does NOT normalize delimiter *choices*: `_i_` → `*i*` and
 * `<https://a>` → `[https://a](https://a)` are semantically identical and
 * round-trip stably, so rewriting them would only manufacture diff noise.
 */
export function normalizeMarkdown(markdown: string): string {
  return (
    markdown
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/, ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      // Strip surrounding blank lines only. The first line's *indentation* is
      // left alone: four leading spaces is a Markdown indented code block, and
      // trimming it would silently change the document's meaning.
      .replace(/^\n+/, '')
      .replace(/\n+$/, '')
  )
}

/** Parse + serialize + normalize — the canonical "current Markdown" for a doc. */
export function normalizeDocToMarkdown(doc: DocNode): string {
  return normalizeMarkdown(docToMarkdown(doc))
}

/* -------------------------------------------------------------------------- */
/* Plain-text projection — spec 12 § 9.3                                      */
/* -------------------------------------------------------------------------- */

/**
 * Text emitted *after* a block of the given type when flattening to prose.
 * Paragraph-level blocks get a blank line; run-level blocks get a single one.
 */
const BLOCK_SEPARATORS: Record<string, string> = {
  blockquote: '\n\n',
  bulletList: '\n',
  codeBlock: '\n\n',
  heading: '\n\n',
  horizontalRule: '\n\n',
  listItem: '\n',
  orderedList: '\n',
  paragraph: '\n\n',
  table: '\n',
  tableRow: '\n',
  taskItem: '\n',
  taskList: '\n',
}

/**
 * Flatten a document to prose.
 *
 * S-2.7 validates "Content: Required, min 50 chars". Measuring that on raw
 * Markdown would count punctuation: `**#**` is six characters of markup and one
 * of prose. This walks the parsed document instead.
 */
export function docToText(doc: DocNode | null): string {
  const parts: string[] = []
  const walk = (node: DocNode): void => {
    if (typeof node.text === 'string') {
      parts.push(node.text)
      return
    }
    if (node.type === 'hardBreak') {
      parts.push('\n')
      return
    }
    for (const child of node.content ?? []) walk(child)
    parts.push(BLOCK_SEPARATORS[node.type] ?? '\n')
  }
  if (doc) walk(doc)
  return parts
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Prose length of a Markdown string, as the S-2.7 50-character rule needs it. */
export function markdownToText(markdown: string): string {
  return docToText(markdownToDoc(markdown))
}

/* -------------------------------------------------------------------------- */
/* Round-trip invariants — spec 12 § 10.2                                    */
/* -------------------------------------------------------------------------- */

export interface RoundTripResult {
  /** True when a second parse/serialize pass changes nothing. */
  stable: boolean
  /** The canonical Markdown for the input. */
  markdown: string
  /** Prose that survives a round trip. */
  text: string
}

/**
 * RT1/RT2/RT3: parse → serialize → parse again and confirm the second output is
 * byte-identical to the first. Idempotence is the property that proves a
 * document will not drift on every autosave.
 */
export function roundTrip(markdown: string): RoundTripResult {
  const first = normalizeDocToMarkdown(markdownToDoc(markdown))
  const second = normalizeDocToMarkdown(markdownToDoc(first))
  return { stable: first === second, markdown: first, text: docToText(markdownToDoc(first)) }
}

/* -------------------------------------------------------------------------- */
/* Loss audit — spec 12 § 3.3 / § 9.3                                         */
/* -------------------------------------------------------------------------- */

export type MarkdownIssueCode = 'loses_content' | 'unstable_round_trip' | 'empty_body'

export interface MarkdownIssue {
  code: MarkdownIssueCode
  /** Human-readable; states what is wrong and how to fix it (Part 11 § Forms). */
  message: string
  /** Up to this many source words that the editor would drop. */
  examples: string[]
}

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu

function words(value: string): string[] {
  return value.toLowerCase().match(WORD_RE) ?? []
}

/**
 * Strip Markdown *syntax* to get the prose an author typed.
 *
 * Purpose-built for the audit rather than reusing `stripMarkdown` (an AI-prompt
 * helper), because this must also discard syntax scaffolding that is not
 * content: ordered-list numbering (`1.`, `2.`) and fenced-code info strings
 * (` ```js `). Counting those as words would flag every valid list and code
 * block as lossy.
 */
function stripSyntax(markdown: string): string {
  return (
    markdown
      // Fenced code: drop the fence lines *and* their info string.
      .replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n?([\s\S]*?)\n?[ \t]*\1[^\n]*$/gm, '$2')
      .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')
      // Reference definitions carry no prose — their URL lives in the link node,
      // which `CONSTRUCTS` already counts structurally.
      .replace(/^[ \t]*\[[^\]]+\]:[ \t]*\S+[^\n]*$/gm, ' ')
      .replace(/!\[([^\]]*)\](?:\([^)]*\)|\[[^\]]*\])/g, ' ')
      .replace(/\[([^\]]*)\](?:\([^)]*\)|\[[^\]]*\])/g, '$1')
      // Autolinked and bare URLs contribute host words that are not prose.
      .replace(/<(?:https?|mailto):[^>\s]+>/g, ' ')
      .replace(/(?:https?:\/\/|www\.)[^\s<>()]+/g, ' ')
      .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
      .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
      .replace(/^[ \t]{0,3}>[ \t]?/gm, '')
      .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, '')
      .replace(/\[[ xX]\][ \t]*/g, '')
      .replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, '')
      .replace(/[*_~]+/g, '')
      .replace(/\|/g, ' ')
      // Table delimiter rows (`| --- | :---: |`) carry no content.
      .replace(/^[ \t]*[-: |]+$/gm, ' ')
  )
}

/**
 * Significant words only: at least two letters. Drops list numbering, bare
 * numbers, and single-character fragments that are far more likely to be syntax
 * than content.
 */
function contentWords(value: string): string[] {
  return words(value).filter((word) => word.replace(/[^\p{L}]/gu, '').length >= 2)
}

/**
 * Structural constructs whose *degradation* is the failure mode catalogued in
 * spec 12 § 3.3. With the D-2 extension set each survives; without it,
 * `![alt](url)` collapses to `alt`, a GFM table collapses to nothing, and
 * `- [x] done` collapses to `- done` — silently, with no error.
 *
 * The count is taken from the Markdown source and compared against the count in
 * the round-tripped Markdown. Because both sides go through the *same* pipeline,
 * even a crude matcher is symmetric: a construct it miscounts is miscounted
 * identically on both sides, so the comparison stays sound.
 */
const CONSTRUCTS: { label: string; count: (md: string) => number }[] = [
  // Both the inline (`(...)`) and reference (`[...]`) forms are counted, so a
  // reference link resolving into an inline link is not reported as a loss.
  {
    label: 'image',
    count: (md) => (md.match(/!\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])/g) ?? []).length,
  },
  { label: 'table row', count: (md) => (md.match(/^[ \t]*\|.*$/gm) ?? []).length },
  { label: 'task item', count: (md) => (md.match(/\[[ xX]\]/g) ?? []).length },
  {
    label: 'fenced code block',
    count: (md) => (md.match(/^[ \t]*(?:`{3,}|~{3,})/gm) ?? []).length,
  },
  { label: 'heading', count: (md) => (md.match(/^[ \t]{0,3}#{1,6}[ \t]+\S/gm) ?? []).length },
  {
    label: 'link',
    count: (md) => (md.match(/(?<!!)\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])/g) ?? []).length,
  },
  { label: 'blockquote', count: (md) => (md.match(/^[ \t]{0,3}>[ \t]?\S/gm) ?? []).length },
]

/**
 * Detect content the editor would silently drop.
 *
 * When marked tokenizes a construct that has no registered handler, the handler
 * chain yields nothing and the node disappears — no error, no warning. Two
 * independent signals are used:
 *
 *  1. **Structural** — a construct present in the source but missing from the
 *     round-tripped Markdown (this is what catches an image degrading to its
 *     alt text, which is *word-for-word* identical and so invisible to the
 *     lexical check).
 *  2. **Lexical** — prose words present in the source but absent after a round
 *     trip. Image alt text is excluded here because it lives in a node
 *     attribute, not in prose; signal 1 already covers it.
 */
export function auditMarkdown(markdown: string): MarkdownIssue[] {
  const issues: MarkdownIssue[] = []
  const result = roundTrip(markdown)
  const output = result.markdown

  if (markdown.trim() === '' || output === '') {
    if (markdown.trim() !== '' && output === '') {
      issues.push({
        code: 'loses_content',
        message:
          'This lesson body is Markdown the editor cannot render, so saving it would empty the lesson. Supported: headings, lists, task lists, quotes, code blocks, tables, links, images, and inline formatting.',
        examples: contentWords(stripSyntax(markdown)).slice(0, 5),
      })
    }
    return issues
  }

  const degraded: string[] = []
  for (const construct of CONSTRUCTS) {
    const before = construct.count(markdown)
    const after = construct.count(output)
    if (before > after) degraded.push(`${construct.label} (${before} → ${after})`)
  }
  if (degraded.length > 0) {
    issues.push({
      code: 'loses_content',
      message: `The editor cannot render ${degraded.join(', ')} in this body, and saving would remove ${degraded.length === 1 ? 'it' : 'them'}. Review the Markdown source.`,
      examples: degraded,
    })
  }

  const expected = contentWords(stripSyntax(markdown))
  const kept = new Set(contentWords(result.text))
  const missing = expected.filter((word) => !kept.has(word))
  if (missing.length > 0) {
    issues.push({
      code: 'loses_content',
      message: `${missing.length} word${missing.length === 1 ? '' : 's'} in this body are not supported by the editor and would be removed on save. Review the Markdown source.`,
      examples: [...new Set(missing)].slice(0, 5),
    })
  }

  if (!result.stable) {
    issues.push({
      code: 'unstable_round_trip',
      message:
        'This Markdown re-serializes differently on every save, which would create a change on every autosave. Simplify the affected syntax or rewrite it in the source view.',
      examples: [],
    })
  }

  return issues
}

/** `auditMarkdown` reduced to a boolean, for hot paths. */
export function isLossless(markdown: string): boolean {
  return auditMarkdown(markdown).length === 0
}

/* -------------------------------------------------------------------------- */
/* Summary — drives the editor footer stats and the S-2.7 50-char rule        */
/* -------------------------------------------------------------------------- */

export interface MarkdownSummary {
  textLength: number
  wordCount: number
  headingCount: number
  imageCount: number
  tableCount: number
  taskCount: number
  codeBlockCount: number
  linkCount: number
}

function countTypes(doc: DocNode): Record<string, number | undefined> {
  // Explicitly possibly-undefined: a node type that never appears is genuinely
  // absent, and the callers below coalesce with `?? 0`.
  const counts: Record<string, number | undefined> = {}
  const walk = (node: DocNode): void => {
    counts[node.type] = (counts[node.type] ?? 0) + 1
    for (const child of node.content ?? []) walk(child)
  }
  walk(doc)
  return counts
}

export function summarizeMarkdown(markdown: string): MarkdownSummary {
  const doc = markdownToDoc(markdown)
  const counts = countTypes(doc)
  const text = docToText(doc)
  let linkCount = 0
  const walkMarks = (node: DocNode): void => {
    for (const mark of node.marks ?? []) if (mark.type === 'link') linkCount += 1
    for (const child of node.content ?? []) walkMarks(child)
  }
  walkMarks(doc)
  return {
    textLength: text.length,
    wordCount: words(text).length,
    headingCount: counts.heading ?? 0,
    imageCount: counts.image ?? 0,
    tableCount: counts.table ?? 0,
    taskCount: counts.taskItem ?? 0,
    codeBlockCount: counts.codeBlock ?? 0,
    linkCount,
  }
}

/** S-2.7: "Content: Required, min 50 chars." Measured on prose, not markup. */
export const LESSON_MIN_TEXT_LENGTH = 50
