import { describe, expect, test } from 'bun:test'
import {
  autoMapColumns,
  buildImportPlan,
  parseCsv,
  parseMarkdownOutline,
  SAMPLE_IMPORT_CSV,
} from '#/features/courses/courses.import-rows'

describe('parseCsv', () => {
  test('parses quoted cells, commas, and newlines', () => {
    const table = parseCsv(SAMPLE_IMPORT_CSV)
    expect(table.headers).toEqual([
      'Module Name',
      'Lesson Title',
      'Video URL',
      'Body',
      'Duration (min)',
    ])
    expect(table.rows.length).toBe(3)
    expect(table.rows[0]?.[0]).toBe('Reading Skills')
    expect(table.rows[0]?.[3]).toContain('Skimming is reading quickly')
    expect(table.rows[0]?.[4]).toBe('25')
  })

  test('handles escaped quotes inside quoted cells', () => {
    const table = parseCsv('Module,Title\nA,"He said ""hi"""')
    expect(table.rows[0]?.[1]).toBe('He said "hi"')
  })
})

describe('parseMarkdownOutline', () => {
  test('maps headings to module/lesson rows with body content', () => {
    const table = parseMarkdownOutline(
      '# Reading Skills\n### Skimming Basics\nSkimming reads for gist.\n\n### Scanning\n## Listening\n### Note-taking',
    )
    expect(table.headers[0]).toBe('Module Name')
    expect(table.rows.length).toBe(3)
    expect(table.rows[0]?.[0]).toBe('Reading Skills')
    expect(table.rows[0]?.[1]).toBe('Skimming Basics')
    expect(table.rows[0]?.[3]).toContain('Skimming reads for gist.')
    expect(table.rows[2]?.[0]).toBe('Listening')
  })
})

describe('autoMapColumns', () => {
  test('maps typical headers and ignores unknown ones', () => {
    const mapping = autoMapColumns([
      'Module Name',
      'Lesson Title',
      'Video URL',
      'Body',
      'Duration (min)',
      'Notes',
    ])
    expect(mapping['Module Name']).toBe('module')
    expect(mapping['Lesson Title']).toBe('lesson_title')
    expect(mapping['Video URL']).toBe('video_url')
    expect(mapping['Body']).toBe('content')
    expect(mapping['Duration (min)']).toBe('duration')
    expect(mapping['Notes']).toBe('ignore')
  })
})

describe('buildImportPlan', () => {
  const headers = ['Module Name', 'Lesson Title', 'Video URL', 'Body', 'Duration (min)']
  const mapping = autoMapColumns(headers)

  test('groups rows into modules and reindexes', () => {
    const plan = buildImportPlan(
      {
        headers,
        rows: [
          ['Reading', 'Skimming', 'https://youtu.be/abc', 'Body text', '25'],
          ['Reading', 'Scanning', '', 'More text', '20'],
          ['Listening', 'Notes', '', 'Notes body', '30'],
        ],
      },
      mapping,
    )
    expect(plan.modules.length).toBe(2)
    expect(plan.modules[0]?.title).toBe('Reading')
    expect(plan.modules[0]?.lessons.length).toBe(2)
    expect(plan.modules[0]?.lessons[0]?.durationMinutes).toBe(25)
    expect(plan.skipped.length).toBe(0)
  })

  test('skips rows missing a lesson title and flags bad video urls', () => {
    const plan = buildImportPlan(
      {
        headers,
        rows: [
          ['Reading', '', 'https://youtu.be/abc', '', '10'],
          ['Reading', 'Scanning', 'https://example.com/nope', '', 'not-a-number'],
        ],
      },
      mapping,
    )
    expect(plan.skipped.length).toBe(1)
    expect(plan.warnings.length).toBe(2)
    expect(plan.modules[0]?.lessons[0]?.videoUrl).toBe('https://example.com/nope')
    expect(plan.modules[0]?.lessons[0]?.durationMinutes).toBeNull()
  })

  test('suffixes duplicate titles within a module', () => {
    const plan = buildImportPlan(
      {
        headers,
        rows: [
          ['M', 'Drill', '', '', ''],
          ['M', 'drill', '', '', ''],
        ],
      },
      mapping,
    )
    expect(plan.modules[0]?.lessons[0]?.title).toBe('Drill')
    expect(plan.modules[0]?.lessons[1]?.title).toBe('drill (2)')
  })

  test('blocks rows exceeding the 50k content cap', () => {
    const plan = buildImportPlan(
      { headers, rows: [['M', 'Big', '', 'x'.repeat(50_001), '']] },
      mapping,
    )
    expect(plan.skipped.length).toBe(1)
    expect(plan.modules.length).toBe(0)
  })
})
