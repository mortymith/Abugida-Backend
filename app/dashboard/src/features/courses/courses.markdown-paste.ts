/**
 * Paste sanitisation for the Lesson Editor — spec 12 § 7.8.
 *
 * `transformPastedHTML` is a single hook on the Tiptap editor, pure and
 * unit-testable, that is the only path clipboard HTML takes. Revision 2 said
 * nothing, so a paste from Word or Google Docs imported a page of `mso-`
 * markup and inline styles into the body.
 *
 * Rules (verbatim from § 7.8):
 *
 *  - Strip `style`, `class`, `id`, and every `mso-*` / `Mso*` attribute
 *    unconditionally — the editor's stylesheet is the only styling.
 *  - Remove `<o:p>` and Office XML namespace nodes entirely.
 *  - `<b>` / `<strong>` → bold mark; `<i>` / `<em>` → italic mark. A
 *    `<b>`/`<i>` wrapper carrying no semantic weight (empty, whitespace-only,
 *    or nested inside another `<b>`/`<i>`) is unwrapped, not converted — this
 *    is what stops Word's double-wrapping from producing `***bold***`.
 *  - `div` and `span` unwrap to their text content.
 *  - Two or more consecutive empty paragraphs collapse to one — a paste never
 *    introduces a run of blank blocks.
 *  - A pasted `<table>` converts to a GFM table only for spreadsheet TSV
 *    (the `text/html` clipboard flavour of a range copied from Sheets/Excel).
 *    An arbitrary web table pastes as its cell text, one row per paragraph —
 *    a general HTML→GFM table converter is a data-loss surface and is out of
 *    scope (§ 14).
 *  - A pasted image follows § 7.5 and never lands as a data URI.
 *
 * The function takes an HTML string and returns a sanitised HTML string. It is
 * deliberately DOM-light: it uses a minimal regex-based walker rather than
 * `DOMParser`, so the same code runs in `bun test` without a DOM shim and in
 * the browser without a parser round-trip. Tiptap feeds the result back into
 * its own DOMParser, which is where the schema-valid node construction
 * happens; this function's job is to strip the noise Word/Docs add, not to
 * validate the schema.
 */

/**
 * Strip `style`, `class`, `id`, and every `mso-*` / `Mso*` attribute from a
 * single tag's attribute string. Returns the cleaned attribute string
 * (possibly empty).
 */
function stripAttributes(attrString: string): string {
  // Match attributes one at a time. Attributes are `name="value"` or
  // `name='value'` or `name=value` or just `name`.
  const kept: string[] = []
  const re = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
  let match: RegExpExecArray | null
  while ((match = re.exec(attrString)) !== null) {
    const name = match[1]
    if (!name) continue
    const lower = name.toLowerCase()
    // Strip style, class, id unconditionally.
    if (lower === 'style' || lower === 'class' || lower === 'id') continue
    // Strip every mso-* / Mso* attribute. The case-insensitive match catches
    // both `mso-` and `Mso` prefixes (Word emits both).
    if (/^mso/i.test(lower)) continue
    // Strip Office XML namespace attributes (o:, v:, w:, etc.) — they belong
    // to namespaces the editor does not understand and would only confuse the
    // parser.
    if (/^[ovw]:/i.test(lower)) continue
    // Reconstruct the attribute. Use double quotes consistently.
    const value = match[2] ?? match[3] ?? match[4] ?? ''
    kept.push(value === '' ? name : `${name}="${value}"`)
  }
  return kept.length > 0 ? ' ' + kept.join(' ') : ''
}

/**
 * Walk the HTML string tag-by-tag, applying the § 7.8 rules. The walker is
 * deliberately simple: it does not build a tree, it just recognises open
 * tags, close tags, and self-closing tags, and emits a transformed version.
 */
export function transformPastedHTML(input: string): string {
  if (!input) return ''
  let result = ''
  let i = 0
  // Track the open-tag stack so we can unwrap `div`, `span`, and
  // empty/whitespace-only `<b>`/`<i>` wrappers. `openTagStart` is the index
  // in `result` BEFORE the open tag was emitted; `openTagEnd` is the index
  // AFTER. Unwrapping means replacing `result.slice(openTagStart)` with
  // `result.slice(openTagEnd)` — i.e., dropping the open tag, keeping the
  // inner, and dropping the close tag.
  const stack: Array<{ tag: string; openTagStart: number; openTagEnd: number }> = []
  // Track whether we have just emitted a blank paragraph, so we can collapse
  // runs of 2+ empty paragraphs into one.
  let lastWasBlankParagraph = false

  while (i < input.length) {
    if (input[i] === '<') {
      // Find the matching '>'.
      const end = input.indexOf('>', i)
      if (end === -1) {
        // Malformed; emit the rest as text.
        result += input.slice(i)
        break
      }
      const tagContent = input.slice(i + 1, end)
      i = end + 1

      // Self-closing tag (e.g. `<br/>`, `<img/>`).
      if (tagContent.endsWith('/')) {
        const selfClosing = processSelfClosingTag(tagContent.slice(0, -1))
        if (selfClosing) {
          result += selfClosing
          lastWasBlankParagraph = false
        }
        continue
      }

      // Close tag.
      if (tagContent.startsWith('/')) {
        const tagName = tagContent.slice(1).trim().toLowerCase()
        const stackEntry = stack.pop()
        // Spec 12 § 7.8: empty/whitespace-only `<b>`/`<i>` wrappers are
        // unwrapped, not converted. The unwrap happens at close time: if the
        // content between the open and close is empty/whitespace-only AND the
        // tag is `b`/`i`/`strong`/`em`, drop BOTH the open and close tags,
        // keeping only the inner content.
        if (
          stackEntry &&
          (tagName === 'b' || tagName === 'i' || tagName === 'strong' || tagName === 'em')
        ) {
          const inner = result.slice(stackEntry.openTagEnd)
          if (inner.trim() === '') {
            // Unwrap: drop the open tag, keep the inner, drop the close tag.
            result = result.slice(0, stackEntry.openTagStart) + inner
            lastWasBlankParagraph = false
            continue
          }
        }
        // Spec 12 § 7.8: `div` and `span` unwrap to their text content. The
        // unwrap happens at close time: drop the close tag. The open tag was
        // already dropped at open time (see processOpenTag).
        if (tagName === 'div' || tagName === 'span') {
          // Drop the close tag entirely.
          continue
        }
        // Spec 12 § 7.8: remove `<o:p>` entirely. The open tag was dropped at
        // open time; drop the close tag here.
        if (tagName === 'o:p') {
          continue
        }
        // Spec 12 § 7.8: for `</p>`, the `lastWasBlankParagraph` flag is
        // intentionally NOT reset here. The flag tracks "the previous
        // paragraph block was blank", and that property survives the close
        // tag so the next `<p>` can collapse against it. Text content inside
        // a paragraph already reset the flag when it was emitted.
        result += `</${tagName}>`
        continue
      }

      // Open tag. Process and emit.
      const { emitted, dropBlankParagraphBefore, tagName, unwrap } = processOpenTag(tagContent)
      if (unwrap) {
        // `div`, `span`, `o:p` — push a stack entry so the close tag knows to
        // drop itself, but don't emit the open tag. openTagStart and
        // openTagEnd are the same (nothing was emitted).
        stack.push({ tag: tagName, openTagStart: result.length, openTagEnd: result.length })
      } else if (emitted) {
        if (dropBlankParagraphBefore && lastWasBlankParagraph) {
          // Spec 12 § 7.8: two or more consecutive empty paragraphs collapse
          // to one. Drop the previous blank paragraph and emit this one.
          result = result.replace(/<p>\s*<\/p>\s*$/, '')
        }
        const openTagStart = result.length
        result += emitted
        const openTagEnd = result.length
        if (tagName === 'p') {
          // Mark whether this paragraph is empty; we'll know at the next open
          // tag. For now, assume empty until we see text content.
          lastWasBlankParagraph = true
        } else {
          lastWasBlankParagraph = false
        }
        stack.push({ tag: tagName, openTagStart, openTagEnd })
      }
      continue
    }

    // Text content. Emit as-is. The editor's own DOMParser handles entity
    // decoding; this function is a noise-stripper, not an entity decoder.
    const nextTag = input.indexOf('<', i)
    const text = nextTag === -1 ? input.slice(i) : input.slice(i, nextTag)
    i = nextTag === -1 ? input.length : nextTag
    if (text.trim() !== '') {
      lastWasBlankParagraph = false
    }
    result += text
  }

  return result
}

interface ProcessedOpenTag {
  /** The emitted HTML for the open tag, or null if the tag should be dropped. */
  emitted: string | null
  /** Whether to drop a preceding blank paragraph (collapse rule). */
  dropBlankParagraphBefore: boolean
  /** The lowercased tag name. */
  tagName: string
  /** True when the tag is unwrapped (div/span/o:p) — emit nothing, track on stack. */
  unwrap: boolean
}

function processOpenTag(tagContent: string): ProcessedOpenTag {
  // Split tag name from attributes.
  const spaceIdx = tagContent.search(/\s/)
  const tagName = (spaceIdx === -1 ? tagContent : tagContent.slice(0, spaceIdx)).toLowerCase()
  const attrString = spaceIdx === -1 ? '' : tagContent.slice(spaceIdx + 1)

  // Spec 12 § 7.8: remove `<o:p>` entirely.
  if (tagName === 'o:p') {
    return { emitted: null, dropBlankParagraphBefore: false, tagName, unwrap: true }
  }
  // Spec 12 § 7.8: `div` and `span` unwrap to their text content.
  if (tagName === 'div' || tagName === 'span') {
    return { emitted: null, dropBlankParagraphBefore: false, tagName, unwrap: true }
  }

  // All other tags: keep the tag but strip the noise attributes.
  const cleanedAttrs = stripAttributes(attrString)
  // `<b>` / `<i>` wrappers that carry no semantic weight are unwrapped at
  // close time (see the close-tag handler in `transformPastedHTML`). The open
  // tag is emitted normally here; if the inner turns out to be empty, the
  // close handler removes both tags.
  return {
    emitted: `<${tagName}${cleanedAttrs}>`,
    dropBlankParagraphBefore: tagName === 'p',
    tagName,
    unwrap: false,
  }
}

function processSelfClosingTag(tagContent: string): string | null {
  const spaceIdx = tagContent.search(/\s/)
  const tagName = (spaceIdx === -1 ? tagContent : tagContent.slice(0, spaceIdx)).toLowerCase()
  const attrString = spaceIdx === -1 ? '' : tagContent.slice(spaceIdx + 1)
  // `<o:p/>` and friends: drop entirely.
  if (tagName === 'o:p') return null
  const cleanedAttrs = stripAttributes(attrString)
  return `<${tagName}${cleanedAttrs} />`
}

/**
 * Convert a spreadsheet TSV clipboard payload to a GFM table. The browser
 * emits `text/html` for ranges copied from Sheets/Excel with a `<table>` of
 * the selected cells; this function takes that HTML and produces a GFM table
 * string the editor can paste as Markdown.
 *
 * Returns null when the input does not look like a single-table spreadsheet
 * paste — in which case the editor falls back to pasting the cell text, one
 * row per paragraph (§ 7.8).
 */
export function spreadsheetHtmlToGfmTable(html: string): string | null {
  // A spreadsheet paste is exactly one `<table>` wrapping `<tr>` rows.
  // Anything more complex (nested tables, divs around the table, multiple
  // tables) is treated as a web table and falls back to the text path.
  const tableMatch = html.match(/^[\s]*<table[^>]*>([\s\S]*?)<\/table>[\s]*$/i)
  if (!tableMatch) return null
  const inner = tableMatch[1]
  const rows = inner.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi)
  if (!rows || rows.length === 0) return null
  // Reject if any row contains a nested table.
  if (rows.some((row) => /<table/i.test(row))) return null

  const parsed: string[][] = rows.map((row) => {
    const cells = row.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) ?? []
    return cells.map((cell) =>
      cell
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .trim(),
    )
  })
  if (parsed.length === 0) return null
  const colCount = parsed[0]?.length ?? 0
  if (colCount === 0) return null

  const header = parsed[0]
  const delimiter = header.map(() => '---')
  const lines: string[] = []
  lines.push(`| ${header.join(' | ')} |`)
  lines.push(`| ${delimiter.join(' | ')} |`)
  for (const row of parsed.slice(1)) {
    // Pad rows that are shorter than the header; the GFM table needs every
    // row to have the same column count.
    const padded = [...row, ...Array.from({ length: colCount - row.length }, () => '')].slice(
      0,
      colCount,
    )
    lines.push(`| ${padded.join(' | ')} |`)
  }
  return lines.join('\n')
}
