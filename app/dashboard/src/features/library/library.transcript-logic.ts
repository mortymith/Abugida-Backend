/**
 * Transcript segment rules for S-3.6 (pure logic — unit-tested):
 * - Segment times must be monotonic with no overlaps; overlapping edits snap
 *   to the nearest free gap.
 * - Long-line warning: >42 characters per line / more than 2 lines.
 * - Click-to-seek formatting helpers.
 */

export interface SegmentLike {
  segmentIndex: number
  startMs: number
  endMs: number
}

export interface MonotonicIssue {
  segmentIndex: number
  message: string
}

export const MAX_CHARS_PER_LINE = 42
export const MAX_LINES = 2

/** Validates a full ordered segment list: positive spans + no overlaps. */
export function validateMonotonic(segments: SegmentLike[]): MonotonicIssue[] {
  const issues: MonotonicIssue[] = []
  let previous: SegmentLike | undefined
  for (const segment of segments) {
    if (segment.endMs <= segment.startMs) {
      issues.push({
        segmentIndex: segment.segmentIndex,
        message: 'Segment end must be after its start.',
      })
    }
    if (previous && segment.startMs < previous.endMs) {
      issues.push({
        segmentIndex: segment.segmentIndex,
        message: 'Segment overlaps the previous one.',
      })
    }
    previous = segment
  }
  return issues
}

/**
 * Fits [start, end] for `index` into the free gap left by all other
 * segments. Returns the adjusted span; when no valid placement exists
 * (e.g. the neighbours fully surround it) returns null so the caller can
 * show a validation error instead of silently corrupting timing.
 */
export function snapToFreeGap(
  segments: SegmentLike[],
  index: number,
  startMs: number,
  endMs: number,
): { startMs: number; endMs: number } | null {
  const ordered = [...segments].sort((a, b) => a.startMs - b.startMs)
  let previousEnd = 0
  for (const segment of ordered) {
    if (segment.segmentIndex === index) continue
    if (segment.startMs >= endMs) break
    previousEnd = Math.max(previousEnd, segment.endMs)
  }
  // Free gap = (previousEnd, nextStart).
  const nextStart = ordered.find(
    (segment) => segment.segmentIndex !== index && segment.startMs >= endMs,
  )?.startMs

  const width = Math.max(1, endMs - startMs)
  let snappedStart = Math.max(startMs, previousEnd)
  let snappedEnd = Math.max(snappedStart + width, endMs)
  if (nextStart != null && snappedEnd > nextStart) {
    // Prefer keeping the start; shrink into the gap when there is room.
    if (nextStart - snappedStart >= 200) {
      snappedEnd = nextStart
    } else if (nextStart - previousEnd >= 200) {
      snappedStart = Math.max(previousEnd, nextStart - width)
      snappedEnd = nextStart
    } else {
      return null
    }
  }
  if (snappedEnd <= snappedStart) return null
  return { startMs: snappedStart, endMs: snappedEnd }
}

export interface LineWarning {
  segmentIndex: number
  message: string
}

/**
 * Readability hints (spec: segments exceeding 42 characters per line / 2
 * lines get a warning). Hard newlines in the text count as line breaks.
 */
export function longLineWarnings(
  segments: { segmentIndex: number; text: string }[],
): LineWarning[] {
  const warnings: LineWarning[] = []
  segments.forEach((segment) => {
    const lines = segment.text.split('\n')
    const tooLong = lines.some((line) => line.length > MAX_CHARS_PER_LINE)
    const tooManyLines = lines.length > MAX_LINES
    if (tooLong || tooManyLines) {
      const reasons = [
        tooLong ? `lines exceed ${MAX_CHARS_PER_LINE} characters` : null,
        tooManyLines ? `more than ${MAX_LINES} lines` : null,
      ]
        .filter(Boolean)
        .join(' and ')
      warnings.push({ segmentIndex: segment.segmentIndex, message: `Readability: ${reasons}.` })
    }
  })
  return warnings
}

/** "01:23" / "1:02:03" / "00:04.5" → ms; null when unparseable. */
export function parseClock(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parts = trimmed.split(':')
  if (parts.length > 3) return null
  let total = 0
  for (const part of parts) {
    if (!/^\d+(\.\d+)?$/.test(part)) return null
    total = total * 60 + Number(part)
  }
  return Math.round(total * 1000)
}

/** ms → "MM:SS" (or "H:MM:SS" past an hour) for segment chips. */
export function formatClock(ms: number): string {
  const clamped = Math.max(0, Math.round(ms))
  const hours = Math.floor(clamped / 3_600_000)
  const minutes = Math.floor((clamped % 3_600_000) / 60_000)
  const seconds = Math.floor((clamped % 60_000) / 1000)
  const pad = (value: number) => value.toString().padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}
