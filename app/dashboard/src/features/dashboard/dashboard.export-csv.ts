/**
 * Minimal client-side CSV export used by the dashboard Export buttons
 * (spec S-1.1/S-1.2). The full Export Reports flow is spec S-5.4 — until that
 * module exists, the buttons export the currently loaded data.
 */
export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

function escapeCell(value: string | number | null | undefined): string {
  if (value == null) return ''
  const raw = String(value)
  if (/[",\n\r]/.test(raw)) return `"${raw.replaceAll('"', '""')}"`
  return raw
}

export function buildCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const headerLine = columns.map((column) => escapeCell(column.header)).join(',')
  const bodyLines = rows.map((row) =>
    columns.map((column) => escapeCell(column.value(row))).join(','),
  )
  return [headerLine, ...bodyLines].join('\r\n')
}

export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
