/**
 * Transcript segment rules for S-3.6 (pure logic — unit-tested):
 * - Segment times must be monotonic with no overlaps; overlapping edits snap
 *   to the nearest free gap.
 * - Long-line warning: >42 characters per line / more than 2 lines.
 * - Click-to-seek formatting helpers.
 */

export interface SegmentLike {
  /** Optional: callers that only have timings (e.g. a range merge) get the
   *  array position reported instead. */
  segmentIndex?: number | undefined
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
  segments.forEach((segment, position) => {
    const segmentIndex = segment.segmentIndex ?? position
    if (segment.endMs <= segment.startMs) {
      issues.push({
        segmentIndex,
        message: 'Segment end must be after its start.',
      })
    }
    if (previous && segment.startMs < previous.endMs) {
      issues.push({
        segmentIndex,
        message: 'Segment overlaps the previous one.',
      })
    }
    previous = segment
  })
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
  const others = segments.filter((segment) => segment.segmentIndex !== index)
  const width = Math.max(1, endMs - startMs)
  const MIN_SLICE = 200

  // Gap boundaries from the neighbours that would surround the edit.
  let leftBound = 0
  for (const other of others) {
    if (other.startMs < startMs) leftBound = Math.max(leftBound, other.endMs)
  }
  let rightBound = Number.POSITIVE_INFINITY
  for (const other of others) {
    if (other.startMs >= startMs) rightBound = Math.min(rightBound, other.startMs)
  }

  const snappedStart = Math.max(startMs, leftBound)
  const snappedEnd = Math.min(Math.max(endMs, snappedStart + 1), rightBound)
  if (snappedEnd - snappedStart >= MIN_SLICE) {
    return { startMs: snappedStart, endMs: snappedEnd }
  }
  // No room keeping the start — place the whole span before the right bound.
  if (rightBound - leftBound >= MIN_SLICE) {
    const placedStart = Math.max(leftBound, Math.min(snappedStart, rightBound - width))
    return { startMs: placedStart, endMs: Math.max(placedStart + 1, rightBound) }
  }
  return null
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

// ---------------------------------------------------------------------------
// Track selection (per-range retry + language switching)
// ---------------------------------------------------------------------------

export interface TranscriptTrackLike {
  language: string
}

export interface TrackSelection<T extends TranscriptTrackLike = TranscriptTrackLike> {
  /** Language to report back to the caller. */
  language: string
  /** The track to load, or null when the requested language has no track. */
  track: T | null
}

/**
 * Resolves which transcript track a request should read.
 *
 * When the caller asks for a language that has **no** track, the answer is an
 * empty track for exactly that language — never another language's track.
 * Falling back silently would hand the editor one language's cues while the
 * language selector shows another, and the next save would then persist those
 * cues under the wrong language code.
 *
 * With no explicit request (and no tracks at all) the default `en` label is
 * used so the editor still renders.
 */
export function selectTranscriptTrack<T extends TranscriptTrackLike>(
  available: readonly T[],
  requested: string | null | undefined,
  defaultLanguage = 'en',
): TrackSelection<T> {
  if (requested) {
    const exact = available.find((track) => track.language === requested) ?? null
    return { language: requested, track: exact }
  }
  const first = available.at(0)
  if (first) return { language: first.language, track: first }
  return { language: defaultLanguage, track: null }
}

export interface TimedCue {
  startMs: number
  endMs: number
  speaker?: string | null
  text: string
}

/** Shortest span a regenerated cue is allowed to occupy. */
export const MIN_SEGMENT_MS = 200

/**
 * Rebuilds a track after re-transcribing `[rangeStartMs, rangeEndMs)`.
 *
 * Freshly recognised cues are **clamped to the requested window** and then
 * de-overlapped. Both steps are required: the recognizer works on the whole
 * file, so a cue routinely straddles the window boundary, and provider output
 * can itself contain overlapping cues. Passing either through unchanged
 * produced a track the server's monotonic check rejected, so "Regenerate this
 * range" failed outright instead of repairing the range.
 *
 * Kept segments are the ones entirely outside the window. The result is
 * ordered by start time and is always safe for `validateMonotonic`.
 */
export function mergeTranscriptRange(
  existing: readonly TimedCue[],
  fresh: readonly TimedCue[],
  rangeStartMs: number,
  rangeEndMs: number,
): TimedCue[] {
  const start = Math.max(0, Math.min(rangeStartMs, rangeEndMs))
  const end = Math.max(start, Math.max(rangeStartMs, rangeEndMs))

  const kept = existing
    .filter((cue) => cue.endMs <= start || cue.startMs >= end)
    .map((cue) => ({
      startMs: cue.startMs,
      endMs: cue.endMs,
      speaker: cue.speaker,
      text: cue.text,
    }))

  // Clamp into the window, then walk in start order pushing each cue past the
  // previous one. A cue squeezed out of existence is dropped, not emitted
  // inverted — the caller decides whether the range came back empty.
  const clamped = fresh
    .filter((cue) => cue.startMs < end && cue.endMs > start)
    .map((cue) => ({
      startMs: Math.max(cue.startMs, start),
      endMs: Math.max(cue.endMs, start),
      speaker: cue.speaker ?? null,
      text: cue.text,
    }))
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)

  const replacement: TimedCue[] = []
  let previousEnd = start
  for (const cue of clamped) {
    // Everything is sorted by start, so once a cue cannot fit, none after it can.
    if (cue.startMs < previousEnd) cue.startMs = previousEnd
    if (cue.startMs >= end) break
    const cueEnd = Math.min(Math.max(cue.endMs, cue.startMs + MIN_SEGMENT_MS), end)
    replacement.push({
      startMs: cue.startMs,
      endMs: cueEnd,
      speaker: cue.speaker,
      text: cue.text,
    })
    previousEnd = cueEnd
  }

  return [...kept, ...replacement].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
}
