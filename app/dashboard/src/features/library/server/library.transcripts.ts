import { createServerFn } from '@tanstack/react-start'
import {
  transcriptDeleteSchema,
  transcriptGenerateSchema,
  transcriptGetSchema,
  transcriptImportSchema,
  transcriptSaveSchema,
  transcriptTranslateSchema,
} from '../schemas/library.schema'

/**
 * Transcription & Subtitle Editor backend (S-3.6): read the editable track,
 * save segments (monotonic, server-validated), import .srt/.vtt, auto-
 * transcribe via a configured OpenAI-compatible STT endpoint, translate via
 * the LLM keys, and delete tracks. Export (.srt/.vtt) is client-side.
 */
export const getTranscript = createServerFn({ method: 'GET' })
  .validator((input: unknown) => transcriptGetSchema.parse(input))
  .handler(async ({ data }) => {
    const { getTranscriptImpl } = await import('./library.transcripts.impl.server')
    return getTranscriptImpl(data)
  })

export const saveTranscript = createServerFn({ method: 'POST' })
  .validator((input: unknown) => transcriptSaveSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; segmentCount: number }> => {
    const { saveTranscriptImpl } = await import('./library.transcripts.impl.server')
    return saveTranscriptImpl(data)
  })

export const importTranscriptFile = createServerFn({ method: 'POST' })
  .validator((input: unknown) => transcriptImportSchema.parse(input))
  .handler(async ({ data }) => {
    const { importTranscriptFileImpl } = await import('./library.transcripts.impl.server')
    return importTranscriptFileImpl(data)
  })

export const generateTranscription = createServerFn({ method: 'POST' })
  .validator((input: unknown) => transcriptGenerateSchema.parse(input))
  .handler(async ({ data }): Promise<{ segmentCount: number }> => {
    const { generateTranscriptionImpl } = await import('./library.transcripts.impl.server')
    return generateTranscriptionImpl(data)
  })

export const regenerateTranscriptRange = createServerFn({ method: 'POST' })
  .validator((input: unknown) => transcriptGenerateSchema.parse(input))
  .handler(async ({ data }): Promise<{ segmentCount: number }> => {
    const { regenerateTranscriptRangeImpl } = await import('./library.transcripts.impl.server')
    return regenerateTranscriptRangeImpl(data)
  })

export const translateTranscript = createServerFn({ method: 'POST' })
  .validator((input: unknown) => transcriptTranslateSchema.parse(input))
  .handler(async ({ data }): Promise<{ language: string; segmentCount: number }> => {
    const { translateTranscriptImpl } = await import('./library.transcripts.impl.server')
    return translateTranscriptImpl(data)
  })

export const deleteTranscript = createServerFn({ method: 'POST' })
  .validator((input: unknown) => transcriptDeleteSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { deleteTranscriptImpl } = await import('./library.transcripts.impl.server')
    return deleteTranscriptImpl(data)
  })
