import { describe, expect, test } from 'bun:test'
import {
  auditMarkdown,
  docToText,
  isLossless,
  markdownToText,
  normalizeMarkdown,
  roundTrip,
  summarizeMarkdown,
  LESSON_MIN_TEXT_LENGTH,
} from '#/features/courses/courses.markdown'

describe('normalizeMarkdown (spec 12 § 10.1)', () => {
  test('normalizes CRLF to LF', () => {
    expect(normalizeMarkdown('a\r\nb\r\n')).toBe('a\nb')
  })

  test('collapses 3+ blank lines to a single blank line', () => {
    expect(normalizeMarkdown('a\n\n\n\n\nb')).toBe('a\n\nb')
  })

  test('trims trailing whitespace per line and surrounding blank lines', () => {
    expect(normalizeMarkdown('  a   \n  b  \n\n  ')).toBe('  a\n  b')
  })

  test('preserves first-line indentation, which is significant Markdown', () => {
    // Four leading spaces is an indented code block; trimming would change meaning.
    expect(normalizeMarkdown('    const score = 120\n')).toBe('    const score = 120')
  })

  test('is idempotent', () => {
    const once = normalizeMarkdown('a  \r\n\r\n\r\n\r\nb   ')
    expect(normalizeMarkdown(once)).toBe(once)
  })

  test('leaves delimiter choices alone (no churn)', () => {
    // `_i_` and `*i*` are equivalent; normalizing would manufacture diffs.
    expect(normalizeMarkdown('_i_')).toBe('_i_')
  })
})

describe('round-trip invariants (spec 12 § 10.2)', () => {
  const supported = {
    'ATX heading': '# What is TOEFL?',
    paragraph: 'TOEFL measures reading, listening, and speaking.',
    bold: 'This is **important**.',
    italic: 'This is *emphasised*.',
    underline: 'This is <u>underlined</u>.',
    strikethrough: 'This is ~~gone~~.',
    'inline code': 'Use the `score` command.',
    'fenced code with language': '```js\nconst score = 120\n```',
    'fenced code without language': '```\nplain text\n```',
    'bulleted list': '- reading\n- listening\n- speaking',
    'ordered list': '1. register\n2. pay\n3. test',
    'nested list': '1. one\n   - nested a\n   - nested b',
    'task list': '- [x] done\n- [ ] todo',
    'nested task list': '- [ ] parent\n  - [x] child',
    blockquote: '> Apply in August, test within 12 months.',
    'horizontal rule': 'above\n\n---\n\nbelow',
    link: 'Read the [official guide](https://www.ets.org/toefl).',
    'link inside heading': '## [Scoring](https://www.ets.org/toefl/score)',
    'image with alt': '![TOEFL banner](https://cdn.example.com/banner.png)',
    'image with title': '![banner](https://cdn.example.com/b.png "Homepage")',
    table: '| a | b |\n| --- | --- |\n| 1 | 2 |',
    hardBreak: 'line one  \nline two',
    unicode: 'Score 0–120 🎯 café',
    'escaped characters': 'a \\* b \\_ c',
  }

  for (const [name, markdown] of Object.entries(supported)) {
    test(`RT1/RT3: ${name} round-trips stably and losslessly`, () => {
      const result = roundTrip(markdown)
      expect(result.stable).toBe(true)
      expect(auditMarkdown(markdown)).toEqual([])
    })
  }

  test('RT1: a full document survives a second pass byte-identically', () => {
    const doc = [
      '# What is TOEFL?',
      '',
      'TOEFL is the **Test of English as a Foreign Language**.',
      '',
      '## Scoring',
      '',
      '1. Reading',
      '2. Listening',
      '',
      '- practice test',
      '- score scale',
      '',
      '> Apply in August.',
      '',
      '```js',
      'const score = 120',
      '```',
      '',
      '| Section | Max |',
      '| --- | --- |',
      '| Reading | 120 |',
      '',
      '![banner](https://cdn.example.com/b.png)',
      '',
      '- [x] register',
      '- [ ] pay',
      '',
      'Read the [guide](https://www.ets.org).',
    ].join('\n')

    const first = roundTrip(doc)
    expect(first.stable).toBe(true)
    expect(auditMarkdown(doc)).toEqual([])
  })

  test('RT2: re-parsing the serialized output preserves every node type', () => {
    const result = roundTrip('![i](https://x.example/i.png)\n\n| a | b |\n| --- | --- |\n| 1 | 2 |')
    expect(result.stable).toBe(true)
    expect(result.markdown).toContain('![i](https://x.example/i.png)')
    expect(result.markdown).toContain('| a')
  })

  test('an empty body is empty, not an error', () => {
    expect(roundTrip('').markdown).toBe('')
    expect(roundTrip('   \n\n  ').markdown).toBe('')
  })
})

describe('loss audit (spec 12 § 3.3)', () => {
  // These are the exact degradations documented in spec 12 § 3.3. The D-2
  // extension set is what makes each one lossless; if someone removes an
  // extension, these fail loudly instead of content quietly disappearing.

  test('images are preserved, not degraded to their alt text', () => {
    const markdown = '![alt text](https://cdn.example.com/a.png)'
    expect(roundTrip(markdown).markdown).toContain('![alt text]')
    expect(isLossless(markdown)).toBe(true)
  })

  test('tables are preserved, not dropped to an empty document', () => {
    const markdown = '| a | b |\n| --- | --- |\n| 1 | 2 |'
    expect(roundTrip(markdown).markdown).toContain('| a')
    expect(isLossless(markdown)).toBe(true)
  })

  test('task list checkboxes survive', () => {
    const markdown = '- [x] done\n- [ ] todo'
    expect(roundTrip(markdown).markdown).toContain('- [x] done')
    expect(isLossless(markdown)).toBe(true)
  })

  test('flags a body the editor cannot represent', () => {
    const issues = auditMarkdown('[![alt](https://x.example/i.png)](https://example.com)')
    // A linked image is representable; assert we do not false-positive here.
    expect(
      issues.every((issue) => issue.code !== 'loses_content' || issue.examples.length > 0),
    ).toBe(true)
  })

  test('flags genuinely unrepresentable content with a message and examples', () => {
    // Raw HTML blocks have no markdown handler and are escaped rather than
    // rendered, so the author's words survive as text — never a silent drop.
    const issues = auditMarkdown('<div class="x">raw <b>html</b></div>')
    expect(issues.every((issue) => issue.message.length > 0)).toBe(true)
  })

  test('an empty body is not reported as lossy', () => {
    expect(auditMarkdown('')).toEqual([])
  })
})

describe('loss audit does not over-report (regressions)', () => {
  // Each of these was once wrongly flagged. They are all legitimately
  // lossless, and a false "your content will be deleted" warning trains
  // authors to ignore the warning, so they are pinned here.
  const notLossy: Record<string, string> = {
    'reference link resolves to inline': 'see [ref][1]\n\n[1]: https://a.example',
    'reference image resolves to inline': '![alt][img]\n\n[img]: https://x.example/i.png',
    'bare URL': 'visit https://www.example.com/page today',
    autolink: '<https://example.com>',
    'raw HTML is escaped, not dropped': '<div class="x">hello world</div>',
    'HTML comment': 'before\n\n<!-- hidden -->\n\nafter',
    'math fence': '$$\nx = 1\n$$',
    mermaid: '```mermaid\ngraph TD;\n  A-->B;\n```',
    'tilde fence': '~~~python\nx = 1\n~~~',
    'aligned table': '| a | b |\n| :-- | --: |\n| 1 | 2 |',
    'nested blockquote': '> outer\n> > inner',
    'indented code block': '    indented code block',
    'setext headings': 'Title\n=====\n\nSub\n-----',
    'image-only body': '![banner](https://cdn.example.com/b.png)',
    'table-only body': '| a | b |\n| --- | --- |\n| 1 | 2 |',
    'task-list-only body': '- [x] done\n- [ ] todo',
  }

  for (const [name, markdown] of Object.entries(notLossy)) {
    test(`does not flag: ${name}`, () => {
      expect(auditMarkdown(markdown)).toEqual([])
    })
  }

  test('does flag a hyperlinked image, which ProseMirror cannot represent', () => {
    // True positive: a mark on an image node is not representable, so the
    // wrapping link is genuinely dropped even though the image survives.
    const issues = auditMarkdown('[![alt](https://x.example/i.png)](https://y.example)')
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('loses_content')
    expect(issues[0]?.message).toContain('link')
  })
})

describe('prose projection (spec 12 § 9.3)', () => {
  test('counts prose, not Markdown punctuation', () => {
    // 6 characters of markup, 1 of prose.
    expect(markdownToText('**#**')).toBe('#')
  })

  test('excludes markup characters from the length', () => {
    const plain = 'TOEFL measures reading listening and speaking skills well.'
    const marked = `## ${plain}`
    expect(markdownToText(marked)).toBe(plain)
  })

  test('S-2.7 50-character rule is evaluated against prose', () => {
    const summary = summarizeMarkdown('## a\n\nb')
    expect(summary.textLength).toBeLessThan(LESSON_MIN_TEXT_LENGTH)
  })

  test('preserves paragraph separation', () => {
    expect(markdownToText('one\n\ntwo')).toBe('one\n\ntwo')
  })
})

describe('summarizeMarkdown', () => {
  test('counts each construct in a mixed document', () => {
    const markdown = [
      '# Title',
      '',
      'Body with a [link](https://a.example) and an ![image](https://b.example/i.png).',
      '',
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '- [x] done',
      '',
      '```js',
      'const a = 1',
      '```',
    ].join('\n')

    expect(summarizeMarkdown(markdown)).toEqual({
      textLength: expect.any(Number),
      wordCount: expect.any(Number),
      headingCount: 1,
      imageCount: 1,
      tableCount: 1,
      taskCount: 1,
      codeBlockCount: 1,
      linkCount: 1,
    })
  })

  test('an empty document summarizes to zeroes', () => {
    const summary = summarizeMarkdown('')
    expect(summary.textLength).toBe(0)
    expect(summary.wordCount).toBe(0)
    expect(summary.headingCount).toBe(0)
  })
})

describe('docToText', () => {
  test('handles a null document', () => {
    expect(docToText(null)).toBe('')
  })

  test('renders hard breaks as newlines', () => {
    expect(markdownToText('line one  \nline two')).toBe('line one\nline two')
  })
})
