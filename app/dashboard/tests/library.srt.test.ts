import { describe, expect, test } from 'bun:test'
import {
  detectSubtitleFormat,
  formatTimestamp,
  parseSubtitleFile,
  parseTimestamp,
  toSrt,
  toVtt,
} from '#/features/library/library.srt'

const VALID_SRT = [
  '1',
  '00:00:04,120 --> 00:00:07,800',
  'Welcome back. Today',
  'we are looking at skimming.',
  '',
  '2',
  '00:00:11,000 --> 00:00:14,500',
  'Skimming is reading quickly for the gist.',
  '',
].join('\n')

const VALID_VTT = [
  'WEBVTT',
  '',
  '00:04.120 --> 00:07.800 line:0',
  'Welcome back.',
  '',
  'NOTE this is a comment',
  '',
  '00:11.000 --> 00:14.500',
  'Skimming is quick reading.',
  '',
].join('\n')

describe('srt/vtt parsing (spec 05 S-3.6)', () => {
  test('parses valid srt with multi-line cues', () => {
    const result = parseSubtitleFile(VALID_SRT, 'srt')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cues).toHaveLength(2)
    expect(result.cues[0]).toEqual({
      startMs: 4120,
      endMs: 7800,
      text: 'Welcome back. Today\nwe are looking at skimming.',
    })
  })

  test('parses vtt: header, NOTE blocks, cue settings stripped', () => {
    const result = parseSubtitleFile(VALID_VTT, 'vtt')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cues).toHaveLength(2)
    expect(result.cues[0]?.startMs).toBe(4120)
    expect(result.cues[1]?.text).toBe('Skimming is quick reading.')
  })

  test('reports malformed blocks with line numbers', () => {
    const broken = ['1', 'no timing here', 'hello', '', 'not-a-time --> neither', 'bad'].join('\n')
    const result = parseSubtitleFile(broken, 'srt')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.length).toBe(2)
    expect(result.issues[0]?.line).toBe(1)
    expect(result.issues[0]?.message).toContain('no timing line')
    expect(result.issues[1]?.line).toBe(5)
  })

  test('flags cues without text', () => {
    const result = parseSubtitleFile('1\n00:00:01,000 --> 00:00:02,000\n\n', 'srt')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.message).toContain('no text')
  })

  test('parseTimestamp accepts comma and dot milliseconds, rejects junk', () => {
    expect(parseTimestamp('00:00:04,120')).toBe(4120)
    expect(parseTimestamp('01:00:00.000')).toBe(3_600_000)
    expect(parseTimestamp('04.5')).toBeNull()
  })

  test('srt round-trip keeps timing and text', () => {
    const cues = [
      { startMs: 4000, endMs: 7800, text: 'Hello there.' },
      { startMs: 11000, endMs: 14500, text: 'Second cue.' },
    ]
    expect(parseSubtitleFile(toSrt(cues), 'srt')).toEqual({ ok: true, cues })
  })

  test('vtt round-trip keeps timing and text', () => {
    const cues = [{ startMs: 4000, endMs: 7800, text: 'Hello there.' }]
    const serialized = toVtt(cues)
    expect(serialized.startsWith('WEBVTT')).toBe(true)
    expect(parseSubtitleFile(serialized, 'vtt')).toEqual({ ok: true, cues })
  })

  test('formatTimestamp renders both formats', () => {
    expect(formatTimestamp(4_120, 'srt')).toBe('00:00:04,120')
    expect(formatTimestamp(4_120, 'vtt')).toBe('00:04.120')
    expect(formatTimestamp(3_600_000, 'vtt')).toBe('01:00:00.000')
  })

  test('detectSubtitleFormat by extension or content', () => {
    expect(detectSubtitleFormat('a.vtt', '')).toBe('vtt')
    expect(detectSubtitleFormat('a.srt', '')).toBe('srt')
    expect(detectSubtitleFormat('a', 'WEBVTT\n\n00:01.000 --> 00:02.000\nhi')).toBe('vtt')
  })
})
