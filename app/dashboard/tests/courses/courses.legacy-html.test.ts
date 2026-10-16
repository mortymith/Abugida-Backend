import { describe, expect, test } from 'bun:test'
import {
  convertLegacyHtmlToMarkdown,
  emptyMigrationReport,
  formatMigrationReport,
} from '#/features/courses/courses.legacy-html'
import { auditMarkdown, markdownToText, roundTrip } from '#/features/courses/courses.markdown'

/**
 * Every tag listed in spec 12 § 5.3 must convert, and anything outside that
 * closed set must abort rather than be silently dropped.
 */
describe('legacy HTML conversion (spec 12 § 5.3)', () => {
  const cases: [string, string, string][] = [
    [
      'paragraph',
      '<p>TOEFL measures reading and listening.</p>',
      'TOEFL measures reading and listening.',
    ],
    ['h1', '<h1>Title</h1>', '# Title'],
    ['h2', '<h2>Scoring</h2>', '## Scoring'],
    ['h3', '<h3>Section</h3>', '### Section'],
    ['h4', '<h4>Deep</h4>', '#### Deep'],
    ['h5', '<h5>Deeper</h5>', '##### Deeper'],
    ['h6', '<h6>Deepest</h6>', '###### Deepest'],
    ['strong', '<p><strong>bold</strong></p>', '**bold**'],
    ['b', '<p><b>bold</b></p>', '**bold**'],
    ['em', '<p><em>italic</em></p>', '*italic*'],
    ['i', '<p><i>italic</i></p>', '*italic*'],
    ['s', '<p><s>gone</s></p>', '~~gone~~'],
    ['strike', '<p><strike>gone</strike></p>', '~~gone~~'],
    ['del', '<p><del>gone</del></p>', '~~gone~~'],
    ['u', '<p><u>underlined</u></p>', '++underlined++'],
    ['inline code', '<p><code>score</code></p>', '`score`'],
    ['link', '<p><a href="https://ets.org">ETS</a></p>', '[ETS](https://ets.org)'],
    ['blockquote', '<blockquote><p>Quoted text</p></blockquote>', '> Quoted text'],
    ['horizontal rule', '<p>a</p><hr><p>b</p>', 'a\n\n---\n\nb'],
    ['bullet list', '<ul><li><p>one</p></li><li><p>two</p></li></ul>', '- one\n- two'],
    ['ordered list', '<ol><li><p>first</p></li><li><p>second</p></li></ol>', '1. first\n2. second'],
  ]

  for (const [name, html, expected] of cases) {
    test(`converts ${name}`, () => {
      const result = convertLegacyHtmlToMarkdown(html)
      if (!result.ok) throw new Error(`expected success, got: ${result.reason}`)
      expect(result.markdown).toBe(expected)
    })
  }

  test('converts a tight list (no wrapping paragraphs)', () => {
    const result = convertLegacyHtmlToMarkdown('<ul><li>one</li><li>two</li></ul>')
    if (!result.ok) throw new Error(result.reason)
    expect(result.markdown).toBe('- one\n- two')
  })

  test('converts a code block, preserving the language', () => {
    const result = convertLegacyHtmlToMarkdown(
      '<pre><code class="language-js">const score = 120</code></pre>',
    )
    if (!result.ok) throw new Error(result.reason)
    expect(result.markdown).toBe('```js\nconst score = 120\n```')
  })

  test('converts a code block without a language', () => {
    const result = convertLegacyHtmlToMarkdown('<pre><code>plain text</code></pre>')
    if (!result.ok) throw new Error(result.reason)
    expect(result.markdown).toBe('```\nplain text\n```')
  })

  test('converts nested lists', () => {
    const result = convertLegacyHtmlToMarkdown(
      '<ol><li><p>one</p><ul><li><p>nested</p></li></ul></li></ol>',
    )
    if (!result.ok) throw new Error(result.reason)
    expect(result.markdown).toContain('one')
    expect(result.markdown).toContain('nested')
  })

  test('converts a hard break', () => {
    const result = convertLegacyHtmlToMarkdown('<p>line one<br>line two</p>')
    if (!result.ok) throw new Error(result.reason)
    expect(result.markdown).toBe('line one\nline two')
  })

  test('decodes HTML entities in the source', () => {
    const result = convertLegacyHtmlToMarkdown('<p>Tom &amp; Jerry &quot;quotes&quot;</p>')
    if (!result.ok) throw new Error(result.reason)
    expect(markdownToText(result.markdown)).toBe('Tom & Jerry "quotes"')
  })

  test('re-escapes & and < in the emitted Markdown, stably', () => {
    // The Tiptap serializer deliberately encodes `&` and `<` as entities so they
    // survive a Markdown round trip, and does not encode quotes. This is
    // round-trip safe, which is what matters; asserting the exact escaping here
    // keeps an upstream change from silently re-introducing a parse ambiguity.
    const result = convertLegacyHtmlToMarkdown('<p>Tom &amp; Jerry &lt;3 &quot;q&quot;</p>')
    if (!result.ok) throw new Error(result.reason)
    expect(result.markdown).toBe('Tom &amp; Jerry &lt;3 "q"')
    expect(markdownToText(result.markdown)).toBe('Tom & Jerry <3 "q"')
    expect(roundTrip(result.markdown).stable).toBe(true)
  })

  test('keeps nested marks', () => {
    const result = convertLegacyHtmlToMarkdown('<p><strong>bold <em>and italic</em></strong></p>')
    if (!result.ok) throw new Error(result.reason)
    expect(result.markdown).toBe('**bold *and italic***')
  })

  test('handles a full legacy lesson body end to end', () => {
    const html = [
      '<h2>Scoring</h2>',
      '<p>TOEFL scores range from <strong>0</strong> to <strong>120</strong>.</p>',
      '<p>See the <a href="https://ets.org/toefl">official guide</a>.</p>',
      '<ul><li><p>Reading</p></li><li><p>Listening</p></li></ul>',
      '<blockquote><p>Apply in August.</p></blockquote>',
      '<pre><code class="language-js">const score = 120</code></pre>',
      '<hr>',
    ].join('')

    const result = convertLegacyHtmlToMarkdown(html)
    if (!result.ok) throw new Error(result.reason)

    expect(result.markdown).toContain('## Scoring')
    expect(result.markdown).toContain('**0**')
    expect(result.markdown).toContain('[official guide](https://ets.org/toefl)')
    expect(result.markdown).toContain('- Reading')
    expect(result.markdown).toContain('> Apply in August.')
    expect(result.markdown).toContain('```js')

    // The whole point of the migration: what comes out must be safe to persist.
    expect(auditMarkdown(result.markdown)).toEqual([])
    expect(roundTrip(result.markdown).stable).toBe(true)
  })

  test('an empty body converts to empty markdown', () => {
    const result = convertLegacyHtmlToMarkdown('   ')
    if (!result.ok) throw new Error(result.reason)
    expect(result.markdown).toBe('')
  })
})

describe('legacy HTML aborts on unknown markup', () => {
  // Silently dropping unknown tags is the exact data-loss failure this feature
  // exists to prevent, so these rows are reported instead of converted.
  const unsupported: [string, string][] = [
    ['figure', '<p>text</p><figure><img src="a.png"></figure>'],
    ['img', '<p><img src="a.png" alt="x"></p>'],
    ['table', '<table><tr><td>a</td></tr></table>'],
    ['div', '<div class="x">content</div>'],
    ['span', '<p><span>text</span></p>'],
    ['iframe', '<iframe src="https://youtube.com/embed/x"></iframe>'],
    ['script', '<script>alert(1)</script>'],
  ]

  for (const [tag, html] of unsupported) {
    test(`aborts on <${tag}> with a reason`, () => {
      const result = convertLegacyHtmlToMarkdown(html)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.markdown).toBeNull()
      expect(result.reason).toContain(tag)
    })
  }

  test('reports an offset for the offending markup', () => {
    const result = convertLegacyHtmlToMarkdown('<p>fine</p><figure></figure>')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.offset).not.toBeNull()
    expect(result.offset).toBeGreaterThan(0)
  })
})

describe('migration report', () => {
  test('renders a summary line and lists unconvertible rows', () => {
    const report = {
      ...emptyMigrationReport(),
      scanned: 1284,
      migrated: 1201,
      alreadyMarkdown: 60,
      skippedEmpty: 19,
      skippedUnconvertible: 1,
      rows: [
        {
          lessonPublicId: '7f3c1a20-0000-4000-8000-000000000000',
          title: 'Advanced Tonal Patterns',
          status: 'skipped_unconvertible' as const,
          reason: 'unexpected <figure>',
          offset: 812,
        },
      ],
    }

    const text = formatMigrationReport(report)
    expect(text).toContain('lessons scanned: 1284')
    expect(text).toContain('migrated: 1201')
    expect(text).toContain('skipped (unconvertible): 1')
    expect(text).toContain('Advanced Tonal Patterns')
    expect(text).toContain('unexpected <figure>')
  })

  test('an empty report still renders', () => {
    const text = formatMigrationReport(emptyMigrationReport())
    expect(text).toContain('lessons scanned: 0')
  })
})
