/**
 * Bulk-import row pipeline (spec 04 S-2.13): CSV/Markdown parsing, column
 * auto-mapping, and row-level validation. Pure + client-safe so bun tests
 * exercise it directly; the server fn re-runs it authoritatively.
 */

export interface ParsedTable {
  headers: string[]
  rows: string[][]
}

/** Minimal RFC-4180-ish CSV reader: quoted cells, escaped quotes, CRLF. */
export function parseCsv(text: string): ParsedTable {
  const rows: string[][] = []
  let cell = ''
  let row: string[] = []
  let inQuotes = false

  const pushCell = () => {
    row.push(cell)
    cell = ''
  }
  const pushRow = () => {
    pushCell()
    if (row.length > 1 || row[0].trim() !== '') rows.push(row)
    row = []
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      pushCell()
    } else if (char === '\n') {
      pushRow()
    } else if (char === '\r') {
      // swallow; handled by the \n branch
    } else {
      cell += char
    }
  }
  if (cell !== '' || row.length > 0) pushRow()

  const [headers = [], ...body] = rows
  return { headers: headers.map((header) => header.trim()), rows: body }
}

/**
 * Markdown structure: `# ` / `## ` start modules, `### ` starts lessons.
 * Body text until the next heading becomes lesson content.
 */
export function parseMarkdownOutline(text: string): ParsedTable {
  const lines = text.split(/\r?\n/)
  const rows: string[][] = []
  let moduleTitle = ''
  let lessonTitle = ''
  let contentLines: string[] = []

  const flushLesson = () => {
    if (lessonTitle) {
      rows.push([moduleTitle, lessonTitle, '', contentLines.join('\n').trim(), ''])
    }
    contentLines = []
  }

  for (const line of lines) {
    const moduleMatch = /^(#{1,2})\s+(.*)$/.exec(line)
    const lessonMatch = /^###\s+(.*)$/.exec(line)
    if (moduleMatch) {
      flushLesson()
      moduleTitle = moduleMatch[2].trim()
      lessonTitle = ''
    } else if (lessonMatch) {
      flushLesson()
      lessonTitle = lessonMatch[1].trim()
    } else if (lessonTitle && line.trim()) {
      contentLines.push(line.trimEnd())
    }
  }
  flushLesson()

  return {
    headers: ['Module Name', 'Lesson Title', 'Video URL', 'Body', 'Duration (min)'],
    rows,
  }
}

export const IMPORT_FIELDS = [
  'module',
  'lesson_title',
  'video_url',
  'content',
  'duration',
  'ignore',
] as const
export type ImportField = (typeof IMPORT_FIELDS)[number]

export type ImportMapping = Record<string, ImportField>

const HEADER_HINTS: Array<[RegExp, ImportField]> = [
  [/module|unit|section/i, 'module'],
  [/lesson.*title|^title$|lesson/i, 'lesson_title'],
  [/video|url|link/i, 'video_url'],
  [/content|body|text|description/i, 'content'],
  [/duration|minutes|time/i, 'duration'],
]

/** Auto-map headers to fields; ambiguous headers map to `ignore`. */
export function autoMapColumns(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {}
  const used = new Set<ImportField>(['ignore'])
  for (const header of headers) {
    const match = HEADER_HINTS.find(([pattern, field]) => pattern.test(header) && !used.has(field))
    if (match) {
      mapping[header] = match[1]
      used.add(match[1])
    } else {
      mapping[header] = 'ignore'
    }
  }
  return mapping
}

export interface ImportRowIssue {
  rowIndex: number
  message: string
}

export interface ValidatedImport {
  modules: Array<{
    title: string
    lessons: Array<{
      title: string
      videoUrl: string | null
      content: string | null
      durationMinutes: number | null
    }>
  }>
  warnings: ImportRowIssue[]
  skipped: ImportRowIssue[]
}

const VIDEO_URL_PATTERN = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\/\S+/i

export const MAX_IMPORT_CONTENT_LENGTH = 50_000

/** Spec: lesson title required; invalid video URLs flagged, not blocked; 50k char cap. */
export function buildImportPlan(table: ParsedTable, mapping: ImportMapping): ValidatedImport {
  const warnings: ImportRowIssue[] = []
  const skipped: ImportRowIssue[] = []
  const moduleByTitle = new Map<
    string,
    { title: string; lessons: ValidatedImport['modules'][number]['lessons'] }
  >()
  const lessonTitlesPerModule = new Map<string, Set<string>>()

  table.rows.forEach((row, rowIndex) => {
    const get = (field: ImportField): string => {
      const index = Object.entries(mapping)
        .filter(([, value]) => value === field)
        .map(([header]) => table.headers.indexOf(header))
        .find((index) => index >= 0)
      const cell = index == null ? undefined : row[index]
      return (cell ?? '').trim()
    }

    const moduleTitle = get('module') || 'Imported Module'
    const lessonTitle = get('lesson_title')
    if (!lessonTitle) {
      skipped.push({ rowIndex, message: 'Missing lesson title' })
      return
    }

    const content = get('content') || null
    if (content && content.length > MAX_IMPORT_CONTENT_LENGTH) {
      skipped.push({ rowIndex, message: 'Lesson content exceeds 50,000 characters' })
      return
    }

    const durationRaw = get('duration')
    let durationMinutes: number | null = null
    if (durationRaw) {
      const parsed = Number.parseFloat(durationRaw)
      if (Number.isFinite(parsed) && parsed > 0) {
        durationMinutes = Math.round(parsed)
      } else {
        warnings.push({ rowIndex, message: `"${durationRaw}" is not a valid duration — ignored` })
      }
    }

    const videoUrl = get('video_url') || null
    if (videoUrl && !VIDEO_URL_PATTERN.test(videoUrl)) {
      warnings.push({
        rowIndex,
        message: `"${videoUrl}" is not a YouTube/Vimeo link — imported unvalidated`,
      })
    }

    let titles = lessonTitlesPerModule.get(moduleTitle)
    if (!titles) {
      titles = new Set()
      lessonTitlesPerModule.set(moduleTitle, titles)
    }
    let finalTitle = lessonTitle
    if (titles.has(lessonTitle.toLowerCase())) {
      let counter = 2
      while (titles.has(`${lessonTitle} (${counter})`.toLowerCase())) counter += 1
      finalTitle = `${lessonTitle} (${counter})`
      warnings.push({ rowIndex, message: `Duplicate title renamed to "${finalTitle}"` })
    }
    titles.add(finalTitle.toLowerCase())

    let moduleRecord = moduleByTitle.get(moduleTitle)
    if (!moduleRecord) {
      moduleRecord = { title: moduleTitle, lessons: [] }
      moduleByTitle.set(moduleTitle, moduleRecord)
    }
    moduleRecord.lessons.push({
      title: finalTitle,
      videoUrl,
      content,
      durationMinutes,
    })
  })

  return {
    modules: Array.from(moduleByTitle.values()),
    warnings,
    skipped,
  }
}

/** Downloadable sample matching the mapping hints (S-2.13). */
export const SAMPLE_IMPORT_CSV = [
  'Module Name,Lesson Title,Video URL,Body,Duration (min)',
  'Reading Skills,Skimming Basics,https://youtu.be/example,"Skimming is reading quickly for the main ideas.",25',
  'Reading Skills,Scanning Techniques,https://youtu.be/example2,"Scanning targets specific details in the text.",20',
  'Listening,Note-Taking,,Practice taking structured notes while listening.,30',
].join('\n')
