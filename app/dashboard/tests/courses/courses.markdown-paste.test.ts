/**
 * Spec 12 § 7.8 — paste sanitisation.
 *
 * `transformPastedHTML` is the only path clipboard HTML takes. The function
 * is pure and DOM-light, so `bun test` can exercise every rule directly
 * without a DOM shim.
 */
import { test, describe, expect } from 'bun:test'
import {
  transformPastedHTML,
  spreadsheetHtmlToGfmTable,
} from '#/features/courses/courses.markdown-paste'

test('strips style, class, and id attributes unconditionally', () => {
  const input = '<p style="color: red" class="intro" id="p1">Hello</p>'
  const output = transformPastedHTML(input)
  expect(output).toBe('<p>Hello</p>')
})

test('strips mso-* attributes (Word markup)', () => {
  const input =
    '<p class="MsoNormal" style="mso-margin-top-alt: auto; mso-margin-bottom-alt: auto">Text</p>'
  const output = transformPastedHTML(input)
  // class and style are stripped unconditionally; the mso-* declarations are
  // inside style, which is already gone. The text survives.
  expect(output).toBe('<p>Text</p>')
})

test('removes <o:p> Office XML namespace nodes entirely', () => {
  const input = '<p>Before<o:p></o:p>After</p>'
  const output = transformPastedHTML(input)
  expect(output).toBe('<p>BeforeAfter</p>')
})

test('unwraps empty <b> wrappers instead of converting them', () => {
  // Spec 12 § 7.8: a `<b>`/`<i>` wrapper carrying no semantic weight (empty,
  // whitespace-only, or nested inside another `<b>`/`<i>`) is unwrapped, not
  // converted — this is what stops Word's double-wrapping from producing
  // `***bold***`.
  const input = '<b>   </b>'
  const output = transformPastedHTML(input)
  expect(output).toBe('   ')
})

test('unwraps empty <i> wrappers', () => {
  const input = '<i></i>'
  const output = transformPastedHTML(input)
  expect(output).toBe('')
})

test('keeps non-empty <b> wrappers as bold marks', () => {
  // The editor's DOMParser converts <b> to a bold mark after this function
  // strips the noise. We just verify the wrapper survives when it has content.
  const input = '<b>important</b>'
  const output = transformPastedHTML(input)
  expect(output).toBe('<b>important</b>')
})

test('unwraps <div> to its text content', () => {
  const input = '<div>Hello world</div>'
  const output = transformPastedHTML(input)
  expect(output).toBe('Hello world')
})

test('unwraps <span> to its text content', () => {
  const input = '<span class="bold">text</span>'
  const output = transformPastedHTML(input)
  expect(output).toBe('text')
})

test('collapses two or more consecutive empty paragraphs to one', () => {
  const input = '<p></p><p></p><p></p>'
  const output = transformPastedHTML(input)
  // The first paragraph is emitted. The second is collapsed (dropped) because
  // the previous was blank. The third is also collapsed. So we expect one
  // paragraph.
  const paragraphCount = (output.match(/<p>/g) ?? []).length
  expect(paragraphCount).toBe(1)
})

test('does not collapse a single empty paragraph', () => {
  const input = '<p></p>'
  const output = transformPastedHTML(input)
  expect(output).toBe('<p></p>')
})

test('does not collapse paragraphs separated by text', () => {
  const input = '<p>first</p><p>second</p>'
  const output = transformPastedHTML(input)
  expect(output).toBe('<p>first</p><p>second</p>')
})

test('strips Office XML namespace attributes (o:, v:, w:)', () => {
  const input = '<p o:title="x" v:shape="y" w:rid="z">Text</p>'
  const output = transformPastedHTML(input)
  expect(output).toBe('<p>Text</p>')
})

test('preserves href on <a> tags', () => {
  const input = '<a href="https://example.com" style="color: blue">link</a>'
  const output = transformPastedHTML(input)
  expect(output).toBe('<a href="https://example.com">link</a>')
})

test('preserves src on <img> tags', () => {
  const input = '<img src="https://cdn.example.com/a.png" alt="alt" style="border: 0" />'
  const output = transformPastedHTML(input)
  // style is stripped; src and alt survive. The closing slash is normalised
  // to ` />` (with a space) by processSelfClosingTag.
  expect(output).toBe('<img src="https://cdn.example.com/a.png" alt="alt" />')
})

test('returns an empty string for empty input', () => {
  expect(transformPastedHTML('')).toBe('')
})

test('handles a complex Word paste', () => {
  // A realistic Word paste: mso styling, o:p tags, double-wrapped b tags,
  // empty paragraphs between sections.
  const input = [
    '<p class="MsoNormal" style="margin: 0">First paragraph.</p>',
    '<p class="MsoNormal"><o:p></o:p></p>',
    '<p class="MsoNormal"><b><b>Double bold</b></b></p>',
    '<p class="MsoNormal"></p>',
    '<p class="MsoNormal">Last.</p>',
  ].join('')
  const output = transformPastedHTML(input)
  // The styling is gone; the o:p is gone; the empty paragraphs collapse.
  expect(output).not.toContain('MsoNormal')
  expect(output).not.toContain('o:p')
  expect(output).not.toContain('margin')
  expect(output).toContain('First paragraph.')
  expect(output).toContain('Last.')
})

describe('spreadsheetHtmlToGfmTable', () => {
  test('converts a single-table spreadsheet paste to GFM', () => {
    const html = '<table><tr><td>a</td><td>b</td></tr><tr><td>1</td><td>2</td></tr></table>'
    const gfm = spreadsheetHtmlToGfmTable(html)
    expect(gfm).toBe('| a | b |\n| --- | --- |\n| 1 | 2 |')
  })

  test('treats the first row as the header', () => {
    const html = '<table><tr><th>Name</th><th>Score</th></tr><tr><td>A</td><td>90</td></tr></table>'
    const gfm = spreadsheetHtmlToGfmTable(html)
    expect(gfm).toContain('| Name | Score |')
    expect(gfm).toContain('| --- | --- |')
    expect(gfm).toContain('| A | 90 |')
  })

  test('pads shorter rows to the header column count', () => {
    const html =
      '<table><tr><td>a</td><td>b</td></tr><tr><td>1</td></tr></table>'
    const gfm = spreadsheetHtmlToGfmTable(html)
    expect(gfm).toContain('| 1 |  |')
  })

  test('returns null for a non-table input (web content)', () => {
    expect(spreadsheetHtmlToGfmTable('<p>not a table</p>')).toBeNull()
  })

  test('returns null for nested tables (data-loss surface, out of scope)', () => {
    const html =
      '<table><tr><td><table><tr><td>nested</td></tr></table></td></tr></table>'
    expect(spreadsheetHtmlToGfmTable(html)).toBeNull()
  })

  test('returns null for an empty table', () => {
    expect(spreadsheetHtmlToGfmTable('<table></table>')).toBeNull()
  })

  test('decodes common HTML entities in cell text', () => {
    const html = '<table><tr><td>a &amp; b</td></tr></table>'
    const gfm = spreadsheetHtmlToGfmTable(html)
    expect(gfm).toContain('a & b')
  })
})
