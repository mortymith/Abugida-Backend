/**
 * SubRip (.srt) / WebVTT (.vtt) parsing + serialization for the S-3.6
 * transcription editor. The parser reports malformed blocks with line
 * numbers (spec: "Import validates .srt/.vtt syntax and reports malformed
 * blocks with line numbers"). Pure logic — unit-tested.
 */

export interface ParsedCue {
  startMs: number
  endMs: number
  text: string
}

export interface ParseIssue {
  line: number
  message: string
}

export type ParseCuesResult = { ok: true; cues: ParsedCue[] } | { ok: false; issues: ParseIssue[] }

const TIMESTAMP_SRT = /^(\d{2,}):(\d{2}):(\d{2})[,.](\d{1,3})$/
const TIMESTAMP_VTT = /^(?:(\d{2,}):)?(\d{2}):(\d{2})[,.](\d{1,3})$/

/** "00:00:04,120" | "00:04.120" → milliseconds. Returns null when invalid. */
export function parseTimestamp(value: string): number | null {
  const trimmed = value.trim()
  const srt = TIMESTAMP_SRT.exec(trimmed)
  if (srt) {
    const [, h, m, s, ms] = srt
    return Number(h) * 3_600_000 + Number(m) * 60_000 + Number(s) * 1000 + Number(ms.padEnd(3, '0'))
  }
  const vtt = TIMESTAMP_VTT.exec(trimmed)
  if (vtt) {
    const [, h, m, s, ms] = vtt
    const hours = h ? Number(h) * 3_600_000 : 0
    return hours + Number(m) * 60_000 + Number(s) * 1000 + Number(ms.padEnd(3, '0'))
  }
  return null
}

/** Milliseconds → "HH:MM:SS,mmm" (srt) or "MM:SS.mmm" / "HH:MM:SS.mmm" (vtt). */
export function formatTimestamp(ms: number, format: 'srt' | 'vtt'): string {
  const clamped = Math.max(0, Math.round(ms))
  const hours = Math.floor(clamped / 3_600_000)
  const minutes = Math.floor((clamped % 3_600_000) / 60_000)
  const seconds = Math.floor((clamped % 60_000) / 1000)
  const millis = clamped % 1000
  const pad = (value: number, width = 2) => value.toString().padStart(width, '0')
  if (format === 'srt') {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`
  }
  const base = `${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`
  return hours > 0 ? `${pad(hours)}:${base}` : base
}

interface RawBlock {
  lines: string[]
  startLine: number
}

function splitBlocks(content: string): RawBlock[] {
  const blocks: RawBlock[] = []
  let current: RawBlock | null = null
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  lines.forEach((line, index) => {
    if (line.trim() === '') {
      current = null
      return
    }
    if (!current) {
      current = { lines: [], startLine: index + 1 }
      blocks.push(current)
    }
    current.lines.push(line)
  })
  return blocks
}

/** Parse .srt or .vtt content into cues; collects every malformed block. */
export function parseSubtitleFile(content: string, format: 'srt' | 'vtt'): ParseCuesResult {
  const issues: ParseIssue[] = []
  const cues: ParsedCue[] = []
  const blocks = splitBlocks(content)
  // WebVTT files open with a "WEBVTT" header line — no cue follows it alone.
  let skippedHeader = false

  blocks.forEach((block) => {
    const first = block.lines[0]?.trim() ?? ''
    if (format === 'vtt' && !skippedHeader && first.startsWith('WEBVTT')) {
      skippedHeader = true
      if (block.lines.length === 1) return
    }

    // Optional cue identifier line before the timestamp line.
    const timestampLineIndex = block.lines.findIndex((line) => line.includes('-->'))
    if (timestampLineIndex < 0) {
      issues.push({
        line: block.startLine,
        message: 'Block has no timing line (expected START --> END).',
      })
      return
    }
    if (timestampLineIndex > 1) {
      issues.push({
        line: block.startLine,
        message: 'Block has more than one line before its timing line.',
      })
      return
    }

    const timestampLine = block.lines[timestampLineIndex] ?? ''
    const [rawStart, rawEnd] = timestampLine.split('-->')
    if (!rawStart || !rawEnd) {
      issues.push({ line: block.startLine + timestampLineIndex, message: 'Malformed timing line.' })
      return
    }
    const startMs = parseTimestamp(rawStart)
    // VTT end timestamps may carry cue settings ("00:04.000 align:start").
    const rawEndClean = rawEnd.trim().split(/\s+/)[0] ?? ''
    const endMs = rawEndClean === '' ? null : parseTimestamp(rawEndClean)
    if (startMs == null || endMs == null) {
      issues.push({
        line: block.startLine + timestampLineIndex,
        message: `Unrecognized timestamp${startMs == null ? ` "${rawStart.trim()}"` : ` "${rawEndClean}"`}.`,
      })
      return
    }

    const textLines = block.lines.slice(timestampLineIndex + 1)
    const text = textLines.join('\n').trim()
    if (text === '') {
      issues.push({
        line: block.startLine + timestampLineIndex,
        message: 'Cue has no text.',
      })
      return
    }
    cues.push({ startMs, endMs, text })
  })

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, cues }
}

/** Detects srt vs vtt by content, defaulting to srt. */
export function detectSubtitleFormat(fileName: string, content: string): 'srt' | 'vtt' {
  if (/\.vtt$/i.test(fileName)) return 'vtt'
  if (/\.srt$/i.test(fileName)) return 'srt'
  return content.replace(/\r\n?/g, '\n').split('\n')[0]?.trim().startsWith('WEBVTT') ? 'vtt' : 'srt'
}

/** Serialize cues to .srt. */
export function toSrt(cues: ParsedCue[]): string {
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatTimestamp(cue.startMs, 'srt')} --> ${formatTimestamp(cue.endMs, 'srt')}\n${cue.text}`,
    )
    .join('\n\n')
    .concat('\n')
}

/** Serialize cues to .vtt. */
export function toVtt(cues: ParsedCue[]): string {
  const body = cues
    .map(
      (cue) =>
        `${formatTimestamp(cue.startMs, 'vtt')} --> ${formatTimestamp(cue.endMs, 'vtt')}\n${cue.text}`,
    )
    .join('\n\n')
  return `WEBVTT\n\n${body}\n`
}
