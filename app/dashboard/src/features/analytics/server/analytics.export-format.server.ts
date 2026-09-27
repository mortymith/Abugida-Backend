/**
 * Server-side report renderers for S-5.4: turn typed report sections into
 * CSV, Excel (xlsx), or PDF (pdf-lib) bytes. Pure with respect to the
 * database — input in, file bytes out.
 */
import { buildCsv } from '#/features/dashboard/dashboard.export-csv'
import type { ReportFormat, ReportType, GeneratedReport } from '../analytics.types'
import type { ReportSection } from '../analytics.export-rows'

const MIME_TYPES: Record<ReportFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
}

const EXTENSIONS: Record<ReportFormat, string> = {
  csv: 'csv',
  xlsx: 'xlsx',
  pdf: 'pdf',
}

const REPORT_SLUGS: Record<ReportType, string> = {
  'course-performance': 'course-performance',
  'student-progress': 'student-progress',
  quiz: 'quiz-analytics',
  revenue: 'revenue',
  'cohort-comparison': 'cohort-comparison',
}

export function reportFilename(reportType: ReportType, format: ReportFormat, now: Date): string {
  const day = now.toISOString().slice(0, 10)
  return `abugida-${REPORT_SLUGS[reportType]}-${day}.${EXTENSIONS[format]}`
}

/** Cell text as it appears in every format (nulls render as em dash). */
function cell(value: string | number | null | undefined): string {
  if (value == null) return '—'
  if (typeof value === 'number') return String(Math.round(value * 100) / 100)
  return value
}

// ── CSV ────────────────────────────────────────────────────────────────────

type ExportRow = Array<string | number | null>

function renderCsv(sections: ReportSection[]): string {
  const blocks = sections.map((section) => {
    const table = buildCsv<ExportRow>(
      section.rows,
      section.columns.map((column, index) => ({
        header: column,
        value: (row: ExportRow) => row[index] ?? '',
      })),
    )
    return `${section.title}\r\n${table}`
  })
  return blocks.join('\r\n\r\n')
}

// ── Excel ──────────────────────────────────────────────────────────────────

async function renderXlsx(sections: ReportSection[]): Promise<Buffer> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  const usedNames = new Set<string>()
  sections.forEach((section, index) => {
    let name =
      section.title
        .replace(/[\\/?*[\]:]/g, ' ')
        .trim()
        .slice(0, 31) || `Sheet${index + 1}`
    let suffix = 2
    while (usedNames.has(name.toLowerCase())) {
      name = `${name.slice(0, 29)}_${suffix}`
      suffix += 1
    }
    usedNames.add(name.toLowerCase())
    const aoa: Array<Array<string | number | null>> = [
      section.columns,
      ...section.rows.map((row) => row.map((value) => value)),
    ]
    const sheet = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(workbook, sheet, name)
  })
  const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return output
}

// ── PDF ────────────────────────────────────────────────────────────────────

const PDF_PAGE = { width: 842, height: 595, margin: 40 } // A4 landscape
const PDF_ROW_HEIGHT = 14
const PDF_FONT_SIZE = 8

/** Rough monospace width so long cells truncate instead of overflowing. */
function truncateMonospace(text: string, maxWidthChars: number): string {
  return text.length > maxWidthChars ? `${text.slice(0, maxWidthChars - 1)}…` : text
}

async function renderPdf(
  title: string,
  metaLines: string[],
  sections: ReportSection[],
): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Courier)
  const bold = await document.embedFont(StandardFonts.CourierBold)

  // The ⚠ flag glyph is outside WinAnsi; PDFs get an ASCII marker instead.
  const sanitize = (value: string) => value.replace(/⚠/g, '!')

  const usableWidth = PDF_PAGE.width - PDF_PAGE.margin * 2
  const charsPerLine = Math.floor(usableWidth / (PDF_FONT_SIZE * 0.6))

  let page = document.addPage([PDF_PAGE.width, PDF_PAGE.height])
  let cursorY = PDF_PAGE.height - PDF_PAGE.margin

  const ensureSpace = (needed: number) => {
    if (cursorY - needed < PDF_PAGE.margin) {
      page = document.addPage([PDF_PAGE.width, PDF_PAGE.height])
      cursorY = PDF_PAGE.height - PDF_PAGE.margin
    }
  }

  const drawText = (text: string, size: number, useBold: boolean) => {
    ensureSpace(size + 4)
    page.drawText(sanitize(text), {
      x: PDF_PAGE.margin,
      y: cursorY - size,
      size,
      font: useBold ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
    })
    cursorY -= size + 4
  }

  drawText(title, 16, true)
  for (const line of metaLines) drawText(line, 10, false)
  cursorY -= 6

  for (const section of sections) {
    ensureSpace(PDF_ROW_HEIGHT * 3)
    drawText(section.title, 12, true)

    const widthPerColumn = Math.max(
      8,
      Math.floor((charsPerLine - section.columns.length) / Math.max(section.columns.length, 1)),
    )
    const formatRow = (values: Array<string | number | null>) =>
      values.map((value) => truncateMonospace(cell(value), widthPerColumn)).join(' | ')

    drawText(formatRow(section.columns.map((name) => name)), PDF_FONT_SIZE, true)
    for (const row of section.rows) {
      ensureSpace(PDF_ROW_HEIGHT)
      drawText(formatRow(row), PDF_FONT_SIZE, false)
    }
    cursorY -= 8
  }

  const bytes = await document.save()
  return Buffer.from(bytes)
}

// ── Entry ──────────────────────────────────────────────────────────────────

/** Render a report and package it for download (base64 over the wire). */
export async function renderReport(
  reportType: ReportType,
  format: ReportFormat,
  title: string,
  metaLines: string[],
  sections: ReportSection[],
  now: Date = new Date(),
): Promise<GeneratedReport> {
  let buffer: Buffer
  if (format === 'xlsx') {
    buffer = await renderXlsx(sections)
  } else if (format === 'pdf') {
    buffer = await renderPdf(title, metaLines, sections)
  } else {
    buffer = Buffer.from(renderCsv(sections), 'utf8')
  }
  return {
    filename: reportFilename(reportType, format, now),
    mimeType: MIME_TYPES[format],
    dataBase64: buffer.toString('base64'),
  }
}
