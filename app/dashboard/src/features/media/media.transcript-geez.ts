/**
 * Ge'ez transcript support (spec 05 § S-3.6).
 *
 * The spec mandates several Ge'ez-specific behaviours:
 * - **Read time is script-aware.** A Ge'ez transcript reports read time
 *   at `ceil(words / 180)`, an English one at `/ 220`. Ge'ez is denser
 *   per "word" and the 220 constant understates a long Amharic track.
 * - **The 42-character rule is Latin-only.** It is advisory for
 *   `am`/`ti`/`gez` and never blocks a save, because a Ge'ez syllable is
 *   wider than a Latin character and the limit would mis-flag every
 *   Amharic segment.
 * - **`.vtt` `lang=` header on export.** The selected `lang` is written
 *   to the `.vtt` (`lang=` header) and `.srt` metadata.
 *
 * This module is framework-free. It complements `media.transcript-logic.ts`
 * which owns the segment timing rules.
 */

export type TranscriptScript = 'latin' | 'ethiopic'

/** Languages that use the Ethiopic (Ge'ez) script. */
export const ETHIOPIC_LANGUAGES: ReadonlySet<string> = new Set(['am', 'ti', 'gez'])

/**
 * Classify a BCP-47 language tag as Latin or Ethiopic script. Used to
 * pick the read-time constant and the 42-char-rule applicability.
 */
export function classifyScript(language: string): TranscriptScript {
  // Normalize: take the primary subtag (before `-`), lowercase.
  const primary = language.split('-')[0]?.toLowerCase() ?? ''
  if (ETHIOPIC_LANGUAGES.has(primary)) return 'ethiopic'
  return 'latin'
}

// ── Read time (script-aware) ───────────────────────────────────────────────

export const LATIN_WORDS_PER_MINUTE = 220
export const ETHIOPIC_WORDS_PER_MINUTE = 180

/**
 * Compute the read time in seconds for a transcript, script-aware.
 *
 * Latin: `ceil(words / 220) * 60`
 * Ethiopic: `ceil(words / 180) * 60`
 *
 * The spec: "A Ge'ez transcript reports read time at `ceil(words / 180)`,
 * an English one at `/ 220` — Ge'ez is denser per 'word' and the 220
 * constant understates a long Amharic track."
 */
export function computeReadTimeSeconds(wordCount: number, language: string): number {
  const script = classifyScript(language)
  const wpm = script === 'ethiopic' ? ETHIOPIC_WORDS_PER_MINUTE : LATIN_WORDS_PER_MINUTE
  if (wordCount <= 0) return 0
  return Math.ceil(wordCount / wpm) * 60
}

/**
 * Format a read-time duration as `Mm` or `Hh Mm`. Used in the transcript
 * header.
 */
export function formatReadTime(seconds: number): string {
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`
}

// ── 42-character rule (Latin-only) ─────────────────────────────────────────

export const MAX_CHARS_PER_LINE_LATIN = 42
export const MAX_LINES_PER_SEGMENT = 2

export interface LongLineWarning {
  readonly segmentId: string
  readonly charCount: number
  readonly lineCount: number
  readonly blocks: boolean
  readonly reason: string
}

/**
 * Generate long-line warnings for a transcript segment. The spec:
 * "Segments exceeding 42 characters per line / 2 lines get a styling
 * hint (readability best practice). **The 42-character rule is
 * Latin-only** — it is advisory for `am`/`ti`/`gez` and never blocks a
 * save."
 *
 * For Ethiopic scripts, the function returns no warnings (advisory only,
 * never blocks).
 */
export function generateLongLineWarnings(
  segmentId: string,
  text: string,
  language: string,
): LongLineWarning | null {
  const script = classifyScript(language)
  if (script === 'ethiopic') {
    // Ethiopic: advisory only, never blocks. Return no warning.
    return null
  }
  // Latin: apply the 42-char / 2-line rule.
  const lines = text.split('\n')
  const lineCount = lines.length
  const maxLineLength = Math.max(...lines.map((l) => l.length))
  if (maxLineLength <= MAX_CHARS_PER_LINE_LATIN && lineCount <= MAX_LINES_PER_SEGMENT) {
    return null
  }
  const blocks = false // advisory, never blocks (per spec)
  const reasons: string[] = []
  if (maxLineLength > MAX_CHARS_PER_LINE_LATIN) {
    reasons.push(
      `Line is ${maxLineLength} characters (recommended max ${MAX_CHARS_PER_LINE_LATIN})`,
    )
  }
  if (lineCount > MAX_LINES_PER_SEGMENT) {
    reasons.push(`${lineCount} lines (recommended max ${MAX_LINES_PER_SEGMENT})`)
  }
  return {
    segmentId,
    charCount: maxLineLength,
    lineCount,
    blocks,
    reason: reasons.join('; '),
  }
}

// ── .vtt lang= header ──────────────────────────────────────────────────────

/**
 * Build the `.vtt` header with the `lang=` attribute. The spec: "The
 * selected `lang` is stored on the transcript, written to each segment,
 * and exported in the `.vtt` (`lang=` header) and `.srt` metadata, so a
 * player's caption menu is correct rather than guessed."
 */
export function buildVttHeader(language: string, region?: string): string {
  const langAttr = `Language: ${language}`
  const regionAttr = region ? `Region: ${region}` : ''
  return `WEBVTT\n${langAttr}${regionAttr ? '\n' + regionAttr : ''}\n`
}

/**
 * Build the `.srt` metadata comment. The `.srt` format has no formal
 * metadata header, but a comment block before the first cue is the
 * conventional place for language metadata.
 */
export function buildSrtMetadata(language: string): string {
  return `NOTE\nLanguage: ${language}\n`
}

// ── Typography ─────────────────────────────────────────────────────────────

/**
 * The Ethiopic typography contract. The spec: "A Ge'ez transcript applies
 * the full Part 11 typography: the `Noto Sans Ethiopic` stack,
 * `line-height: 1.6`, `letter-spacing: normal`, and **no fixed-px line
 * clamp** — the segments list grows, it does not clip."
 */
export interface TranscriptTypography {
  readonly fontFamily: string
  readonly lineHeight: number
  readonly letterSpacing: string
  readonly noLineClamp: boolean
}

export const ETHIOPIC_TYPOGRAPHY: TranscriptTypography = {
  fontFamily: "'Noto Sans Ethiopic', 'Noto Sans', sans-serif",
  lineHeight: 1.6,
  letterSpacing: 'normal',
  noLineClamp: true,
}

export const LATIN_TYPOGRAPHY: TranscriptTypography = {
  fontFamily: "'Inter', system-ui, sans-serif",
  lineHeight: 1.5,
  letterSpacing: 'normal',
  noLineClamp: true,
}

/**
 * Get the typography contract for a transcript language.
 */
export function typographyForLanguage(language: string): TranscriptTypography {
  return classifyScript(language) === 'ethiopic' ? ETHIOPIC_TYPOGRAPHY : LATIN_TYPOGRAPHY
}
