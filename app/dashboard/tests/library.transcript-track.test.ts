import { describe, expect, test } from 'bun:test'
import {
  MIN_SEGMENT_MS,
  mergeTranscriptRange,
  selectTranscriptTrack,
  validateMonotonic,
} from '#/features/library/library.transcript-logic'
import type { TimedCue } from '#/features/library/library.transcript-logic'

describe('selectTranscriptTrack (spec 05 S-3.6 language switching)', () => {
  const tracks = [
    { language: 'en', id: 1 },
    { language: 'am', id: 2 },
  ]

  test('returns the exact track for a requested language', () => {
    expect(selectTranscriptTrack(tracks, 'am')).toEqual({ language: 'am', track: tracks[1] })
    expect(selectTranscriptTrack(tracks, 'en')).toEqual({ language: 'en', track: tracks[0] })
  })

  test('a missing language resolves to an empty track, never another language', () => {
    // Regression: this used to fall back to the first track, so the editor
    // showed English cues under an "OM" selector and the next save persisted
    // them under the wrong language code.
    const selection = selectTranscriptTrack(tracks, 'om')
    expect(selection.language).toBe('om')
    expect(selection.track).toBeNull()
  })

  test('an empty library still yields a usable default language', () => {
    expect(selectTranscriptTrack([], undefined)).toEqual({ language: 'en', track: null })
    expect(selectTranscriptTrack([], 'fr')).toEqual({ language: 'fr', track: null })
    expect(selectTranscriptTrack([], 'fr', 'en')).toEqual({ language: 'fr', track: null })
  })

  test('with no explicit request the first track wins', () => {
    expect(selectTranscriptTrack(tracks, undefined)).toEqual({ language: 'en', track: tracks[0] })
    expect(selectTranscriptTrack(tracks, null)).toEqual({ language: 'en', track: tracks[0] })
    // An empty string is not a language code; treat it as "no request".
    expect(selectTranscriptTrack(tracks, '')).toEqual({ language: 'en', track: tracks[0] })
  })

  test('language matching is case sensitive and never guesses', () => {
    expect(selectTranscriptTrack(tracks, 'EN').track).toBeNull()
    expect(selectTranscriptTrack(tracks, ' en ').track).toBeNull()
  })
})

describe('mergeTranscriptRange (spec 05 S-3.6 per-range retry)', () => {
  const existing: TimedCue[] = [
    { startMs: 0, endMs: 4_000, text: 'before' },
    { startMs: 4_000, endMs: 8_000, text: 'target one' },
    { startMs: 8_000, endMs: 12_000, text: 'target two' },
    { startMs: 12_000, endMs: 16_000, text: 'after' },
  ]

  test('replaces only the requested window and keeps the rest in order', () => {
    const fresh: TimedCue[] = [
      { startMs: 4_000, endMs: 6_000, text: 'new one' },
      { startMs: 6_000, endMs: 8_000, text: 'new two' },
    ]
    const merged = mergeTranscriptRange(existing, fresh, 4_000, 8_000)
    // 'target one' (4s–8s) sits inside the window and is replaced; 'target two'
    // starts exactly at the window end, so it is kept.
    expect(merged.map((cue) => cue.text)).toEqual([
      'before',
      'new one',
      'new two',
      'target two',
      'after',
    ])
    expect(validateMonotonic(merged)).toEqual([])
  })

  test('clamps cues that straddle the window boundary (regression)', () => {
    // The recognizer returns whole-file cues. A cue running 3s→6s inside a
    // 4s→8s window used to be kept at full length and overlapped "before",
    // which made the whole range regeneration fail the monotonic check.
    const fresh: TimedCue[] = [{ startMs: 3_000, endMs: 6_000, text: 'straddles the start' }]
    const merged = mergeTranscriptRange(existing, fresh, 4_000, 8_000)
    expect(merged.map((cue) => cue.text)).toEqual([
      'before',
      'straddles the start',
      'target two',
      'after',
    ])
    expect(merged[1]?.startMs).toBe(4_000)
    expect(merged[1]?.endMs).toBe(6_000)
    expect(validateMonotonic(merged)).toEqual([])
  })

  test('clamps a cue that overruns the end of the window', () => {
    const fresh: TimedCue[] = [{ startMs: 7_000, endMs: 20_000, text: 'runs past the end' }]
    const merged = mergeTranscriptRange(existing, fresh, 4_000, 8_000)
    const clamped = merged.find((cue) => cue.text === 'runs past the end')
    expect(clamped?.startMs).toBe(7_000)
    expect(clamped?.endMs).toBe(8_000)
    expect(validateMonotonic(merged)).toEqual([])
  })

  test('a cue narrower than the minimum span is widened, never inverted', () => {
    const fresh: TimedCue[] = [{ startMs: 9_000, endMs: 9_050, text: 'sliver' }]
    const merged = mergeTranscriptRange([], fresh, 9_000, 9_960)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.startMs).toBe(9_000)
    expect(merged[0]?.endMs).toBe(9_200)
    expect(merged[0]?.endMs).toBeLessThanOrEqual(9_960)
    expect(validateMonotonic(merged)).toEqual([])
    expect(MIN_SEGMENT_MS).toBe(200)
  })

  test('never exceeds the window end, even when the minimum span does not fit', () => {
    const fresh: TimedCue[] = [{ startMs: 9_900, endMs: 9_950, text: 'edge' }]
    const merged = mergeTranscriptRange([], fresh, 9_000, 9_950)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.endMs).toBe(9_950)
    expect(validateMonotonic(merged)).toEqual([])
  })

  test('de-overlaps recognizer output that overlaps itself', () => {
    // Whisper-style output frequently returns overlapping cues. Passing them
    // through made the range regeneration fail the monotonic check.
    const fresh: TimedCue[] = [
      { startMs: 0, endMs: 3_000, text: 'a' },
      { startMs: 2_000, endMs: 5_000, text: 'b' },
      { startMs: 4_000, endMs: 6_000, text: 'c' },
    ]
    const merged = mergeTranscriptRange([], fresh, 0, 6_000)
    expect(merged.map((cue) => cue.text)).toEqual(['a', 'b', 'c'])
    expect(merged[1]?.startMs).toBe(3_000)
    expect(merged[2]?.startMs).toBe(5_000)
    expect(validateMonotonic(merged)).toEqual([])
  })

  test('cues fully outside the window are ignored', () => {
    const fresh: TimedCue[] = [
      { startMs: 0, endMs: 3_000, text: 'before the window' },
      { startMs: 13_000, endMs: 15_000, text: 'after the window' },
    ]
    // Nothing overlaps the window, so nothing is contributed — but the window's
    // own cues are still replaced, leaving a gap the author can re-transcribe.
    const merged = mergeTranscriptRange(existing, fresh, 4_000, 8_000)
    expect(merged.map((cue) => cue.text)).toEqual(['before', 'target two', 'after'])
    expect(validateMonotonic(merged)).toEqual([])
  })

  test('drops segments that partially overlap the window instead of double-speaking them', () => {
    const fresh: TimedCue[] = [{ startMs: 4_000, endMs: 8_000, text: 'replacement' }]
    const merged = mergeTranscriptRange(existing, fresh, 4_000, 8_000)
    expect(merged.map((cue) => cue.text)).toEqual(['before', 'replacement', 'target two', 'after'])
    expect(merged.map((cue) => cue.text)).not.toContain('target one')
  })

  test('normalizes a reversed range rather than producing negative spans', () => {
    const fresh: TimedCue[] = [{ startMs: 5_000, endMs: 7_000, text: 'x' }]
    const merged = mergeTranscriptRange(existing, fresh, 8_000, 4_000)
    expect(validateMonotonic(merged)).toEqual([])
  })

  test('handles an empty starting track and an empty recognizer result', () => {
    expect(mergeTranscriptRange([], [], 0, 1_000)).toEqual([])
    const only = mergeTranscriptRange([], [{ startMs: 0, endMs: 1_000, text: 'a' }], 0, 5_000)
    expect(only.map((cue) => cue.text)).toEqual(['a'])
  })

  test('preserves speaker labels on kept cues', () => {
    const withSpeaker: TimedCue[] = [
      { startMs: 0, endMs: 2_000, text: 'kept', speaker: 'Instructor' },
      { startMs: 2_000, endMs: 4_000, text: 'dropped', speaker: 'Student' },
    ]
    const merged = mergeTranscriptRange(
      withSpeaker,
      [{ startMs: 2_000, endMs: 4_000, text: 'fresh' }],
      2_000,
      4_000,
    )
    expect(merged[0]?.speaker).toBe('Instructor')
    expect(merged[1]?.speaker).toBeNull()
  })

  test('the merged result always passes the monotonic check', () => {
    const messy: TimedCue[] = [
      { startMs: 0, endMs: 1_000, text: 'a' },
      { startMs: 900, endMs: 2_000, text: 'b' },
      { startMs: 5_000, endMs: 5_100, text: 'c' },
      { startMs: 9_000, endMs: 12_000, text: 'd' },
    ]
    const fresh: TimedCue[] = [
      { startMs: 500, endMs: 1_500, text: 'n1' },
      { startMs: 1_400, endMs: 3_000, text: 'n2' },
      { startMs: 10_000, endMs: 11_000, text: 'n3' },
    ]
    const merged = mergeTranscriptRange(messy, fresh, 0, 6_000)
    expect(validateMonotonic(merged)).toEqual([])
  })
})
