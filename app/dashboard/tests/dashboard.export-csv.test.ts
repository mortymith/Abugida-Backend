import { describe, expect, test } from 'bun:test'
import { buildCsv } from '#/features/dashboard/dashboard.export-csv'
import type { CsvColumn } from '#/features/dashboard/dashboard.export-csv'

interface Row {
  name: string
  revenue: number | null
  note?: string
}

const columns: CsvColumn<Row>[] = [
  { header: 'Course', value: (row) => row.name },
  { header: 'Revenue', value: (row) => row.revenue },
  { header: 'Note', value: (row) => row.note ?? null },
]

describe('buildCsv', () => {
  test('renders header plus one line per row with CRLF endings', () => {
    const csv = buildCsv(
      [
        { name: 'TOEFL Complete', revenue: 4680, note: 'ok' },
        { name: 'IELTS Advanced', revenue: 3780 },
      ],
      columns,
    )
    const lines = csv.split('\r\n')
    expect(lines).toEqual(['Course,Revenue,Note', 'TOEFL Complete,4680,ok', 'IELTS Advanced,3780,'])
  })

  test('escapes commas, quotes, and newlines per RFC 4180', () => {
    const csv = buildCsv(
      [{ name: 'Grammar, "Basics" v2', revenue: 100, note: 'line1\nline2' }],
      columns,
    )
    expect(csv).toBe('Course,Revenue,Note\r\n"Grammar, ""Basics"" v2",100,"line1\nline2"')
  })

  test('renders null values as empty cells', () => {
    const csv = buildCsv([{ name: 'Empty Course', revenue: null }], columns)
    expect(csv).toBe('Course,Revenue,Note\r\nEmpty Course,,')
  })

  test('handles empty row sets (header only)', () => {
    const csv = buildCsv([], columns)
    expect(csv).toBe('Course,Revenue,Note')
  })
})
