/**
 * Server-only implementation of S-3.6 Transcription & Subtitle Editor.
 *
 * Provider strategy (honest degradation, mirroring the courses AI module):
 * - Auto-Transcribe requires TRANSCRIPTION_API_KEY (OpenAI-compatible
 *   /audio/transcriptions, `response_format=verbose_json`). Files over the
 *   25MB provider limit are rejected with the .srt/.vtt import alternative.
 * - Translation requires an LLM key (OPENAI/ANTHROPIC/GEMINI) and runs
 *   through `chat()` from `@tanstack/ai` (AGENTS.md §19). Translation is
 *   never faked locally — without a key the UI explains the requirement.
 * - Manual editing and .srt/.vtt import always work without credentials.
 *
 * Segment writes re-validate monotonic timing server-side and replace the
 * stored set transactionally; the published track is what lessons read.
 */
import { and, asc, eq } from '@abugida/database'
import { transcripts, transcriptSegments } from '@abugida/database/catalog'
import { db } from '#/config/db.config'
import { env } from '#/config/app.config'
import { detectSubtitleFormat, parseSubtitleFile } from '../library.srt'
import {
  MIN_SEGMENT_MS,
  mergeTranscriptRange,
  selectTranscriptTrack,
  validateMonotonic,
} from '../library.transcript-logic'
import { isTranscribableCategory } from '../library.asset-category'
import { resolveAsset } from './library.assets.impl.server'
import { getStorage } from './library.presign.impl.server'
import { requireLibraryWriteRole, requireUserId } from './library.server-helpers.server'
import type { TranscriptDTO, TranscriptSegmentDTO } from '../library.types'
import type { TimedCue } from '../library.transcript-logic'
import type { z } from 'zod'
import type {
  TranscriptGenerateInput,
  TranscriptImportInput,
  TranscriptSaveInput,
  TranscriptTranslateInput,
  transcriptDeleteSchema,
  transcriptGetSchema,
} from '../schemas/library.schema'

type TranscriptGetInput = z.infer<typeof transcriptGetSchema>
type TranscriptDeleteInput = z.infer<typeof transcriptDeleteSchema>

/** Provider hard limit (OpenAI Whisper-compatible endpoints). */
const STT_MAX_BYTES = 25 * 1024 * 1024
const STT_TIMEOUT_MS = 180_000

type CaptionStyle = NonNullable<TranscriptDTO['captionStyle']>

function resolveStyle(style: TranscriptSaveInput['captionStyle']): CaptionStyle | null {
  return style ?? null
}

async function resolveTranscribableAsset(assetPublicId: string) {
  const asset = await resolveAsset(assetPublicId)
  if (!isTranscribableCategory(asset.category)) {
    throw new Error('ASSET_NOT_TRANSCRIBABLE: only video and audio assets can be transcribed')
  }
  return asset
}

async function loadSegments(transcriptId: number): Promise<TranscriptSegmentDTO[]> {
  const rows = await db
    .select({
      segmentIndex: transcriptSegments.segmentIndex,
      startMs: transcriptSegments.startMs,
      endMs: transcriptSegments.endMs,
      speaker: transcriptSegments.speaker,
      text: transcriptSegments.text,
    })
    .from(transcriptSegments)
    .where(eq(transcriptSegments.transcriptId, transcriptId))
    .orderBy(asc(transcriptSegments.segmentIndex))
  return rows
}

export async function getTranscriptImpl(input: TranscriptGetInput): Promise<TranscriptDTO> {
  await requireUserId()
  const asset = await resolveTranscribableAsset(input.assetPublicId)

  const trackRows = await db
    .select({
      id: transcripts.id,
      language: transcripts.language,
      status: transcripts.status,
      showByDefault: transcripts.showByDefault,
      source: transcripts.source,
      captionStyle: transcripts.captionStyle,
    })
    .from(transcripts)
    .where(eq(transcripts.assetId, asset.id))
    .orderBy(asc(transcripts.language))

  const availableLanguages = trackRows.map((row) => row.language)
  // A language that has no track resolves to an *empty* track for that exact
  // language. Falling back to another language would show the editor e.g.
  // English cues under an "AM" selector, and the next save would then persist
  // them under the wrong language code.
  const selection = selectTranscriptTrack(trackRows, input.language)
  const language = selection.language
  const track = selection.track

  const segments = track ? await loadSegments(track.id) : []

  return {
    assetPublicId: asset.publicId,
    assetName: asset.name,
    assetMimeType: asset.mimeType,
    assetDurationSeconds: asset.durationSeconds,
    assetFileSizeBytes: asset.fileSizeBytes,
    language,
    status: track?.status ?? 'draft',
    showByDefault: track?.showByDefault ?? true,
    source: track?.source ?? 'manual',
    captionStyle: (track?.captionStyle as CaptionStyle | null) ?? null,
    segments,
    availableLanguages,
  }
}

interface PersistOptions {
  /**
   * Machine-authored writes (STT, .srt/.vtt import) only replace the *cues*.
   * Caption styling and "show by default" are presentation choices the author
   * made in the S-3.6 editor, so re-running the recognizer on one range — or
   * importing a fresh track — must not silently reset them to the defaults.
   */
  preservePresentation?: boolean
}

/** Shared write path: validate → upsert track → replace segments. */
async function persistTrack(
  input: TranscriptSaveInput,
  options: PersistOptions = {},
): Promise<{ ok: true; segmentCount: number }> {
  const asset = await resolveTranscribableAsset(input.assetPublicId)

  const ordered = [...input.segments].sort((a, b) => a.startMs - b.startMs)
  const issues = validateMonotonic(ordered)
  if (issues.length > 0) {
    const first = issues[0]
    throw new Error(
      `INVALID_TIMING: segment ${first.segmentIndex + 1} — ${first.message} Times must be monotonic without overlaps.`,
    )
  }

  const style = resolveStyle(input.captionStyle)

  await db.transaction(async (tx) => {
    const existingRows = await tx
      .select({
        id: transcripts.id,
        captionStyle: transcripts.captionStyle,
        showByDefault: transcripts.showByDefault,
      })
      .from(transcripts)
      .where(and(eq(transcripts.assetId, asset.id), eq(transcripts.language, input.language)))
      .limit(1)
    const existing = existingRows.at(0)
    let trackId = existing?.id
    if (trackId == null) {
      const inserted = await tx
        .insert(transcripts)
        .values({
          assetId: asset.id,
          language: input.language,
          status: input.status,
          showByDefault: input.showByDefault,
          captionStyle: style,
          source: input.source,
        })
        .returning({ id: transcripts.id })
      trackId = inserted.at(0)?.id
    } else {
      const preserve = options.preservePresentation === true
      await tx
        .update(transcripts)
        .set({
          status: input.status,
          showByDefault: preserve
            ? (existing?.showByDefault ?? input.showByDefault)
            : input.showByDefault,
          captionStyle: preserve ? (existing?.captionStyle ?? null) : style,
          source: input.source,
        })
        .where(eq(transcripts.id, trackId))
    }
    if (trackId == null) throw new Error('TRANSCRIPT_SAVE_FAILED')

    await tx.delete(transcriptSegments).where(eq(transcriptSegments.transcriptId, trackId))
    if (ordered.length > 0) {
      await tx.insert(transcriptSegments).values(
        ordered.map((segment, index) => ({
          transcriptId: trackId,
          segmentIndex: index,
          startMs: segment.startMs,
          endMs: segment.endMs,
          speaker: segment.speaker,
          text: segment.text,
        })),
      )
    }
  })

  return { ok: true, segmentCount: ordered.length }
}

export async function saveTranscriptImpl(
  input: TranscriptSaveInput,
): Promise<{ ok: true; segmentCount: number }> {
  await requireLibraryWriteRole()
  return persistTrack(input)
}

export async function importTranscriptFileImpl(input: TranscriptImportInput) {
  await requireLibraryWriteRole()
  const format = detectSubtitleFormat(input.fileName, input.content)
  const parsed = parseSubtitleFile(input.content, format)
  if (!parsed.ok) {
    return {
      ok: false as const,
      issues: parsed.issues.slice(0, 20).map((issue) => ({
        line: issue.line,
        message: issue.message,
      })),
    }
  }
  if (parsed.cues.length === 0) {
    return { ok: false as const, issues: [{ line: 1, message: 'No subtitle cues found.' }] }
  }

  await persistTrack(
    {
      assetPublicId: input.assetPublicId,
      language: input.language,
      segments: parsed.cues.map((cue) => ({
        segmentIndex: 0,
        startMs: cue.startMs,
        endMs: cue.endMs,
        speaker: null,
        text: cue.text,
      })),
      captionStyle: null,
      showByDefault: true,
      status: 'draft',
      source: 'imported',
    },
    { preservePresentation: true },
  )

  return { ok: true as const, segmentCount: parsed.cues.length, format }
}

interface SttSegment {
  start: number
  end: number
  text: string
}

interface SttResponse {
  segments?: SttSegment[]
  text?: string
}

/** Runs the configured STT provider and returns normalized segments (ms). */
async function runStt(objectKey: string, fileSizeBytes: number | null): Promise<SttSegment[]> {
  if (!env.TRANSCRIPTION_API_KEY) {
    throw new Error(
      'TRANSCRIPTION_NOT_CONFIGURED: set TRANSCRIPTION_API_KEY to enable Auto-Transcribe, or import an .srt/.vtt file',
    )
  }
  if (fileSizeBytes != null && fileSizeBytes > STT_MAX_BYTES) {
    throw new Error(
      'FILE_TOO_LARGE_FOR_STT: the transcription provider accepts files up to 25MB — import an .srt/.vtt track instead',
    )
  }

  const storage = getStorage()
  const buffer = await storage.getAsBuffer(objectKey)
  const base = env.TRANSCRIPTION_BASE_URL ?? 'https://api.openai.com/v1'
  const model = env.TRANSCRIPTION_MODEL ?? 'whisper-1'

  const form = new FormData()
  const bytes = new Uint8Array(buffer)
  form.append('file', new Blob([bytes]), 'audio')
  form.append('model', model)
  form.append('response_format', 'verbose_json')

  const response = await fetch(`${base.replace(/\/$/, '')}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.TRANSCRIPTION_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(STT_TIMEOUT_MS),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `TRANSCRIPTION_FAILED: provider responded ${response.status} ${detail.slice(0, 200)}`,
    )
  }
  const payload = (await response.json()) as SttResponse
  const segments = (payload.segments ?? []).filter(
    (segment) =>
      Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.text.trim() !== '',
  )
  if (segments.length === 0 && payload.text?.trim()) {
    // Some providers return plain text without segments — one coarse cue.
    return [{ start: 0, end: 30_000, text: payload.text.trim() }]
  }
  return segments.map((segment) => ({
    start: Math.round(segment.start * 1000),
    end: Math.round(segment.end * 1000),
    text: segment.text.trim(),
  }))
}

export async function generateTranscriptionImpl(input: TranscriptGenerateInput): Promise<{
  segmentCount: number
}> {
  await requireLibraryWriteRole()
  const asset = await resolveTranscribableAsset(input.assetPublicId)
  const cues = await runStt(asset.objectKey, asset.fileSizeBytes)
  if (cues.length === 0) throw new Error('TRANSCRIPTION_EMPTY: no speech was recognized')

  return persistTrack(
    {
      assetPublicId: input.assetPublicId,
      language: input.language,
      segments: cues.map((cue, index) => ({
        segmentIndex: index,
        startMs: cue.start,
        endMs: Math.max(cue.end, cue.start + MIN_SEGMENT_MS),
        speaker: null,
        text: cue.text,
      })),
      captionStyle: null,
      showByDefault: true,
      status: 'draft',
      source: 'stt',
    },
    { preservePresentation: true },
  )
}

/** Per-range retry (spec S-3.6): re-runs STT and replaces overlapping cues. */
export async function regenerateTranscriptRangeImpl(input: TranscriptGenerateInput): Promise<{
  segmentCount: number
}> {
  if (input.rangeStartMs == null || input.rangeEndMs == null) {
    return generateTranscriptionImpl(input)
  }
  await requireLibraryWriteRole()
  const asset = await resolveTranscribableAsset(input.assetPublicId)

  const existingRows = await db
    .select({ id: transcripts.id })
    .from(transcripts)
    .where(and(eq(transcripts.assetId, asset.id), eq(transcripts.language, input.language)))
    .limit(1)
  const trackId = existingRows.at(0)?.id
  if (trackId == null) throw new Error('TRANSCRIPT_NOT_FOUND: generate a full track first')

  const existing = await loadSegments(trackId)
  const fresh = await runStt(asset.objectKey, asset.fileSizeBytes)
  const rangeStart = input.rangeStartMs
  const rangeEnd = input.rangeEndMs

  // "No speech in this range" is about the *recognizer's* output, not about the
  // merged result — cues outside the window always survive the merge.
  const overlapping = fresh.filter((cue) => cue.start < rangeEnd && cue.end > rangeStart)
  if (overlapping.length === 0) {
    throw new Error('TRANSCRIPTION_EMPTY: no speech was recognized in the selected range')
  }

  // runStt already normalizes provider seconds to milliseconds.
  const freshCues: TimedCue[] = fresh.map((cue) => ({
    startMs: cue.start,
    endMs: cue.end,
    speaker: null,
    text: cue.text,
  }))
  const merged = mergeTranscriptRange(existing, freshCues, rangeStart, rangeEnd)

  return persistTrack(
    {
      assetPublicId: input.assetPublicId,
      language: input.language,
      segments: merged.map((cue, index) => ({
        segmentIndex: index,
        startMs: cue.startMs,
        endMs: cue.endMs,
        speaker: cue.speaker ?? null,
        text: cue.text,
      })),
      captionStyle: null,
      showByDefault: true,
      status: 'draft',
      source: 'stt',
    },
    { preservePresentation: true },
  )
}

function activeLlmProvider(): 'openai' | 'anthropic' | 'gemini' | null {
  if (env.OPENAI_API_KEY) return 'openai'
  if (env.ANTHROPIC_API_KEY) return 'anthropic'
  if (env.GEMINI_API_KEY) return 'gemini'
  return null
}

async function llmText(system: string[], user: string): Promise<string> {
  const provider = activeLlmProvider()
  if (!provider) {
    throw new Error(
      'AI_NOT_CONFIGURED: set OPENAI_API_KEY (or ANTHROPIC/GEMINI) to enable translation — you can still paste a translated .srt/.vtt via Import',
    )
  }
  const { chat } = await import('@tanstack/ai')
  let adapter: unknown
  if (provider === 'openai') {
    const mod = await import('@tanstack/ai-openai')
    adapter = mod.openaiText((env.AI_MODEL || 'gpt-4o-mini') as never)
  } else if (provider === 'anthropic') {
    const mod = await import('@tanstack/ai-anthropic')
    adapter = mod.anthropicText((env.AI_MODEL || 'claude-3-5-haiku-latest') as never)
  } else {
    const mod = await import('@tanstack/ai-gemini')
    adapter = mod.geminiText((env.AI_MODEL || 'gemini-1.5-flash') as never)
  }

  const result = await (
    chat as unknown as (options: {
      adapter: unknown
      system?: string[]
      messages: Array<{ role: 'user'; content: string }>
      stream?: false
    }) => Promise<{ text?: string }>
  )({
    adapter,
    system,
    messages: [{ role: 'user', content: user }],
    stream: false,
  })
  const text = result.text ?? ''
  if (text.trim() === '') throw new Error('TRANSLATION_FAILED: the model returned no content')
  return text
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  am: 'Amharic',
  om: 'Oromo',
  ar: 'Arabic',
  fr: 'French',
  sw: 'Swahili',
  es: 'Spanish',
  ti: 'Tigrinya',
}

export async function translateTranscriptImpl(input: TranscriptTranslateInput): Promise<{
  language: string
  segmentCount: number
}> {
  await requireLibraryWriteRole()
  const asset = await resolveTranscribableAsset(input.assetPublicId)

  const sourceRows = await db
    .select({ id: transcripts.id })
    .from(transcripts)
    .where(and(eq(transcripts.assetId, asset.id), eq(transcripts.language, input.fromLanguage)))
    .limit(1)
  const sourceTrackId = sourceRows.at(0)?.id
  if (sourceTrackId == null) {
    throw new Error('TRANSCRIPT_NOT_FOUND: nothing to translate for the source language')
  }
  const sourceSegments = await loadSegments(sourceTrackId)
  if (sourceSegments.length === 0) {
    throw new Error('TRANSCRIPT_EMPTY: the source track has no segments to translate')
  }
  if (input.fromLanguage === input.toLanguage) {
    throw new Error('INVALID_LANGUAGE: source and target languages are the same')
  }

  // Batch segments to keep prompts bounded; line format preserves indices.
  const batchSize = 40
  const translated: string[] = []
  for (let start = 0; start < sourceSegments.length; start += batchSize) {
    const batch = sourceSegments.slice(start, start + batchSize)
    const payload = batch
      .map((segment) => `${segment.segmentIndex}\t${segment.text.replace(/\n/g, ' ')}`)
      .join('\n')
    const fromName = LANGUAGE_NAMES[input.fromLanguage] ?? input.fromLanguage
    const toName = LANGUAGE_NAMES[input.toLanguage] ?? input.toLanguage
    const output = await llmText(
      [
        'You translate video subtitle tracks for an education platform.',
        'Translate every line faithfully, keeping the same tone and reading level.',
        'Output one line per input line, formatted as "<index><TAB><translation>" — no extra lines, no markdown.',
      ],
      `Translate the subtitle lines from ${fromName} to ${toName}:\n\n${payload}`,
    )
    const byIndex = new Map<number, string>()
    output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .forEach((line) => {
        const tabIndex = line.indexOf('\t')
        if (tabIndex <= 0) return
        const index = Number(line.slice(0, tabIndex))
        const text = line.slice(tabIndex + 1).trim()
        if (Number.isInteger(index) && text !== '') byIndex.set(index, text)
      })
    for (const segment of batch) {
      const translatedText = byIndex.get(segment.segmentIndex)
      if (translatedText) {
        translated.push(translatedText)
      } else {
        // Missing lines fall back to the source text rather than dropping a cue.
        translated.push(segment.text)
      }
    }
  }

  await persistTrack(
    {
      assetPublicId: input.assetPublicId,
      language: input.toLanguage,
      segments: sourceSegments.map((segment, index) => ({
        segmentIndex: index,
        startMs: segment.startMs,
        endMs: segment.endMs,
        speaker: segment.speaker,
        text: translated[index] ?? segment.text,
      })),
      captionStyle: null,
      showByDefault: true,
      status: 'draft',
      source: 'translated',
    },
    { preservePresentation: true },
  )

  return { language: input.toLanguage, segmentCount: translated.length }
}

export async function deleteTranscriptImpl(input: TranscriptDeleteInput): Promise<{ ok: true }> {
  await requireLibraryWriteRole()
  const asset = await resolveAsset(input.assetPublicId)
  await db
    .delete(transcripts)
    .where(and(eq(transcripts.assetId, asset.id), eq(transcripts.language, input.language)))
  return { ok: true }
}
