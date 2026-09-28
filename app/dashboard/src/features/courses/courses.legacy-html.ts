/**
 * Legacy lesson HTML → ProseMirror document — spec 12 § 5.3 (Migration).
 *
 * Existing `lessons.body` values hold HTML produced by the *previous* editor via
 * `editor.getHTML()` from a closed schema (StarterKit + link). That makes the set
 * of tags we must understand small, fixed, and fully known — which is why a
 * hand-written converter is safer here than a general HTML parser.
 *
 * Tiptap's own `generateJSON()` cannot be used: it routes through
 * `elementFromString()`, which throws without a DOM, and the migration runs in
 * Bun (spec 12 § 3.4). This module is therefore pure and DOM-free.
 *
 * The single most important property: **an unrecognised tag aborts the row**
 * rather than being guessed at. Silently dropping unknown markup is precisely the
 * data-loss failure this whole feature exists to prevent, so an aborted row is
 * reported for manual triage and left as HTML.
 */
import { normalizeDocToMarkdown } from './courses.markdown'
import type { DocNode } from './courses.markdown'

export interface LegacyConversionOk {
  ok: true
  doc: DocNode
  markdown: string
  reason: null
  offset: null
}

export interface LegacyConversionFailed {
  ok: false
  doc: null
  markdown: null
  reason: string
  /** Character offset into the source HTML, when it could be attributed. */
  offset: number | null
}

export type LegacyConversionResult = LegacyConversionOk | LegacyConversionFailed

const VOID_TAGS = new Set(['br', 'hr'])

/** Block-level tags the legacy editor could emit. */
const HEADINGS: Record<string, number> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 }

/** Inline tag → ProseMirror mark name. */
const MARKS: Record<string, string> = {
  strong: 'bold',
  b: 'bold',
  em: 'italic',
  i: 'italic',
  s: 'strike',
  strike: 'strike',
  del: 'strike',
  code: 'code',
  u: 'underline',
  a: 'link',
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
    }
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
    return ENTITIES[entity.toLowerCase()] ?? match
  })
}

interface Attribute {
  name: string
  value: string
}

function parseAttributes(raw: string): Attribute[] {
  const attributes: Attribute[] = []
  ATTR_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ATTR_RE.exec(raw)) !== null) {
    // Widened via a typed local rather than a cast: TypeScript types
    // `match.groups` as an index signature of `string`, but a group that did not
    // participate in the match is genuinely absent at runtime.
    const group: Record<string, string | undefined> | undefined = match.groups
    if (group?.name === undefined) continue
    attributes.push({
      name: group.name.toLowerCase(),
      value: decodeEntities(group.dq ?? group.sq ?? group.bare ?? ''),
    })
  }
  return attributes
}

type Token =
  | { kind: 'open'; tag: string; attributes: Attribute[]; offset: number }
  | { kind: 'close'; tag: string; offset: number }
  | { kind: 'text'; value: string; offset: number }

/**
 * Named groups throughout: a non-participating group is genuinely `undefined` at
 * runtime, and named groups are the only form TypeScript types that way. Plain
 * numeric groups on `RegExpExecArray` are typed `string`, which hides the case.
 */
const ATTR_RE =
  /(?<name>[a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"(?<dq>[^"]*)"|'(?<sq>[^']*)'|(?<bare>[^\s"'>]+)))?/g

const TAG_RE =
  /<(?<closing>\/?)(?<tag>[a-zA-Z][a-zA-Z0-9-]*)(?<attrs>(?:"[^"]*"|'[^']*'|[^>])*?)(?<self>\/?)>/g

class UnsupportedTag extends Error {
  constructor(
    readonly tag: string,
    readonly offset: number,
  ) {
    super(`unexpected <${tag}>`)
  }
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  TAG_RE.lastIndex = 0

  while ((match = TAG_RE.exec(html)) !== null) {
    const group = match.groups
    const full = match[0]
    const tag = (group?.tag ?? '').toLowerCase()
    const offset = match.index

    if (html.slice(cursor, offset).trim() !== '') {
      tokens.push({
        kind: 'text',
        value: decodeEntities(html.slice(cursor, offset)),
        offset: cursor,
      })
    }
    cursor = offset + full.length

    const attributes = parseAttributes(group?.attrs ?? '')

    if (group?.closing === '/') {
      tokens.push({ kind: 'close', tag, offset })
    } else if (group?.self === '/' || VOID_TAGS.has(tag)) {
      tokens.push({ kind: 'open', tag, attributes, offset })
      if (!VOID_TAGS.has(tag)) tokens.push({ kind: 'close', tag, offset })
    } else {
      tokens.push({ kind: 'open', tag, attributes, offset })
    }
  }

  if (html.slice(cursor).trim() !== '') {
    tokens.push({ kind: 'text', value: decodeEntities(html.slice(cursor)), offset: cursor })
  }
  return tokens
}

const isBlockNode = (node: DocNode): boolean => node.type !== 'text' && node.type !== 'hardBreak'

/** Drop empty trailing paragraphs that XHTML-style serializers leave behind. */
function compactBlocks(nodes: DocNode[]): DocNode[] {
  const out: DocNode[] = []
  for (const node of nodes) {
    if (node.type === 'paragraph' && (node.content ?? []).length === 0) {
      if (out.length === 0) continue
      continue
    }
    if (node.type === 'paragraph' && node.content) {
      const compact = compactInlines(node.content)
      if (compact.length === 0) continue
      out.push({ ...node, content: compact })
      continue
    }
    out.push(node)
  }
  return out
}

/** Trim leading/trailing whitespace-only text nodes inside a block. */
function compactInlines(nodes: DocNode[]): DocNode[] {
  const out = nodes.filter((node) => node.type !== 'text' || (node.text ?? '').trim() !== '')
  // Explicit length guards: this module's tsconfig does not enable
  // `noUncheckedIndexedAccess`, so `out[0]` is typed non-undefined even though an
  // empty array really does yield undefined.
  const first = out.length > 0 ? out[0] : undefined
  const lastIndex = out.length - 1
  const last = lastIndex >= 0 ? out[lastIndex] : undefined
  if (first?.type === 'text') out[0] = { ...first, text: (first.text ?? '').replace(/^\s+/, '') }
  if (last?.type === 'text') {
    out[lastIndex] = { ...last, text: (last.text ?? '').replace(/\s+$/, '') }
  }
  return out.filter((node) => node.type !== 'text' || (node.text ?? '') !== '')
}

/**
 * Convert legacy HTML to Markdown.
 *
 * Returns `ok: false` with a reason and offset for any markup outside the closed
 * legacy schema — the caller (the migration) then leaves that row as HTML.
 */
export function convertLegacyHtmlToMarkdown(html: string): LegacyConversionResult {
  if (html.trim() === '') {
    return { ok: true, doc: { type: 'doc', content: [] }, markdown: '', reason: null, offset: null }
  }

  let tokens: Token[]
  try {
    tokens = tokenize(html)
  } catch (error) {
    if (error instanceof UnsupportedTag) {
      return { ok: false, doc: null, markdown: null, reason: error.message, offset: error.offset }
    }
    return {
      ok: false,
      doc: null,
      markdown: null,
      reason: error instanceof Error ? error.message : 'unknown tokenizer failure',
      offset: null,
    }
  }

  let index = 0

  const peek = (): Token | undefined => tokens[index]

  /**
   * Single-lookup close/open predicates. Written as helpers rather than inline
   * `peek()?.kind === 'close' && peek()?.tag === x` so the token is narrowed once
   * and the two calls can never disagree.
   */
  const atClose = (tag: string): boolean => {
    const token = peek()
    return token?.kind === 'close' && token.tag === tag
  }

  const assertSupported = (tag: string, offset: number): void => {
    if (
      !(tag in HEADINGS) &&
      !(tag in MARKS) &&
      !['p', 'pre', 'ul', 'ol', 'li', 'blockquote', 'br', 'hr'].includes(tag)
    ) {
      throw new UnsupportedTag(tag, offset)
    }
  }

  const nextInline = (): DocNode[] => {
    const out: DocNode[] = []
    const markStack: { type: string; attrs?: Record<string, unknown> }[] = []

    while (index < tokens.length) {
      const token = tokens[index]
      if (index >= tokens.length) break

      if (token.kind === 'text') {
        if (token.value.trim() === '' && out.length === 0 && markStack.length === 0) {
          index += 1
          continue
        }
        const text: DocNode = { type: 'text', text: token.value }
        out.push(markStack.length > 0 ? { ...text, marks: markStack.map((m) => ({ ...m })) } : text)
        index += 1
        continue
      }

      if (token.tag === 'br') {
        out.push({ type: 'hardBreak' })
        index += 1
        continue
      }

      if (token.kind === 'close') {
        const name = MARKS[token.tag]
        if (!name) break
        const at = markStack.map((mark) => mark.type).lastIndexOf(name)
        // A stray close tag (unbalanced markup) is skipped rather than aborting
        // the row: the enclosing block is still well-formed.
        if (at !== -1) markStack.length = at
        index += 1
        continue
      }

      const name = MARKS[token.tag]
      if (!name) break

      assertSupported(token.tag, token.offset)
      if (name === 'link') {
        const href = token.attributes.find((a) => a.name === 'href')?.value ?? ''
        // A link with no href carries no information; drop the tag, keep the text.
        if (href === '') {
          index += 1
          continue
        }
        markStack.push({ type: name, attrs: { href } })
      } else {
        markStack.push({ type: name })
      }
      index += 1
    }

    return out
  }

  const nextBlock = (): DocNode | null => {
    const token = peek()
    if (!token) return null

    if (token.kind === 'close') {
      index += 1
      return null
    }

    if (token.kind === 'text') {
      const content = nextInline()
      return content.length > 0 ? { type: 'paragraph', content } : null
    }

    assertSupported(token.tag, token.offset)

    // Inline markup sitting at the top level (no wrapping <p>) becomes an
    // implicit paragraph rather than being skipped.
    if (MARKS[token.tag]) {
      const content = nextInline()
      return content.length > 0 ? { type: 'paragraph', content } : null
    }

    if (token.tag === 'hr') {
      index += 1
      return { type: 'horizontalRule' }
    }

    if (token.tag === 'br') {
      index += 1
      return { type: 'paragraph', content: [{ type: 'hardBreak' }] }
    }

    if (token.tag in HEADINGS) {
      const level = HEADINGS[token.tag]
      index += 1
      const content = nextInline()
      closeTag(token.tag)
      return { type: 'heading', attrs: { level }, content }
    }

    if (token.tag === 'pre') {
      index += 1
      const languageToken = peek()
      let language: string | null = null
      let code = ''
      if (languageToken?.kind === 'open' && languageToken.tag === 'code') {
        const className = languageToken.attributes.find((a) => a.name === 'class')?.value ?? ''
        language = /language-([\w+-]+)/.exec(className)?.[1] ?? null
        index += 1
        const textToken = peek()
        if (textToken?.kind === 'text') {
          code = textToken.value
          index += 1
        }
        if (atClose('code')) index += 1
      }
      closeTag('pre')
      return {
        type: 'codeBlock',
        ...(language ? { attrs: { language } } : {}),
        ...(code ? { content: [{ type: 'text', text: code }] } : {}),
      }
    }

    if (token.tag === 'blockquote') {
      index += 1
      const blocks: DocNode[] = []
      while (peek() && !atClose('blockquote')) {
        const before = index
        const block = nextBlock()
        if (block) blocks.push(block)
        if (index === before) index += 1
      }
      closeTag('blockquote')
      return { type: 'blockquote', content: compactBlocks(blocks) }
    }

    if (token.tag === 'ul' || token.tag === 'ol') {
      const type = token.tag === 'ul' ? 'bulletList' : 'orderedList'
      const closing = token.tag
      index += 1
      const items: DocNode[] = []
      while (peek() && !atClose(closing)) {
        const before = index
        const item = nextBlock()
        if (item) items.push(item)
        // Never spin: a token that yields no block is consumed regardless.
        if (index === before) index += 1
      }
      closeTag(closing)
      return { type, content: items }
    }

    if (token.tag === 'li') {
      // `token` is already the narrowed `li` open tag; re-reading the array
      // would be both redundant and un-typeable.
      const className = token.attributes.find((a) => a.name === 'class')?.value ?? ''
      const isTask = className.includes('task-list-item')
      index += 1
      const blocks: DocNode[] = []
      while (peek() && !atClose('li')) {
        const before = index
        const block = nextBlock()
        if (block) blocks.push(block)
        if (index === before) index += 1
      }
      closeTag('li')
      const content = compactBlocks(blocks)
      if (isTask) return { type: 'taskItem', attrs: { checked: false }, content }
      return { type: 'listItem', content: content.length > 0 ? content : [{ type: 'paragraph' }] }
    }

    if (token.tag === 'p') {
      index += 1
      const content = nextInline()
      closeTag('p')
      return { type: 'paragraph', content }
    }

    // Unreachable in practice (assertSupported throws first), but advancing
    // here guarantees `convertLegacyHtmlToMarkdown` always terminates.
    index += 1
    return null
  }

  function closeTag(tag: string): void {
    const token = peek()
    if (token && token.kind === 'close' && token.tag === tag) {
      index += 1
      return
    }
    // Unbalanced markup from a hand-edited row: tolerate it rather than abort,
    // because the enclosing element still gives us a well-formed subtree.
  }

  try {
    const blocks: DocNode[] = []
    while (index < tokens.length) {
      const before = index
      const block = nextBlock()
      if (block) blocks.push(block)
      if (index === before) index += 1
    }

    const doc: DocNode = { type: 'doc', content: compactBlocks(blocks) }
    if (doc.content && doc.content.every((node) => isBlockNode(node)) === false) {
      return {
        ok: false,
        doc: null,
        markdown: null,
        reason: 'inline content at the top level of the document',
        offset: null,
      }
    }

    return { ok: true, doc, markdown: normalizeDocToMarkdown(doc), reason: null, offset: null }
  } catch (error) {
    if (error instanceof UnsupportedTag) {
      return { ok: false, doc: null, markdown: null, reason: error.message, offset: error.offset }
    }
    return {
      ok: false,
      doc: null,
      markdown: null,
      reason: error instanceof Error ? error.message : 'unknown conversion failure',
      offset: null,
    }
  }
}

/** Row-level summary used by the migration report (spec 12 § 5.3). */
export interface MigrationReportRow {
  lessonPublicId: string
  title: string
  status: 'migrated' | 'already_markdown' | 'skipped_empty' | 'skipped_unconvertible'
  reason?: string
  offset?: number
}

export interface MigrationReport {
  scanned: number
  migrated: number
  alreadyMarkdown: number
  skippedEmpty: number
  skippedUnconvertible: number
  rows: MigrationReportRow[]
}

export function emptyMigrationReport(): MigrationReport {
  return {
    scanned: 0,
    migrated: 0,
    alreadyMarkdown: 0,
    skippedEmpty: 0,
    skippedUnconvertible: 0,
    rows: [],
  }
}

/** Render the human-readable report shown at the end of a migration run. */
export function formatMigrationReport(report: MigrationReport): string {
  const lines = [
    `lessons scanned: ${report.scanned} · migrated: ${report.migrated} · already markdown: ${report.alreadyMarkdown} · skipped (empty): ${report.skippedEmpty}`,
    `skipped (unconvertible): ${report.skippedUnconvertible}`,
  ]
  for (const row of report.rows.filter((entry) => entry.status === 'skipped_unconvertible')) {
    lines.push(
      `  - ${row.lessonPublicId.slice(0, 8)} "${row.title}" — ${row.reason}${row.offset === undefined ? '' : ` at offset ${row.offset}`}`,
    )
  }
  return lines.join('\n')
}
