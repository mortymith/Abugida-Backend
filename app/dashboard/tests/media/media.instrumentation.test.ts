import { describe, expect, test } from 'bun:test'
import {
  breachesMediaBudget,
  MEDIA_INSTRUMENTATION_EVENTS,
  MEDIA_PERFORMANCE_BUDGETS,
  trackMediaEvent,
  validateMediaPayload,
} from '#/features/media/media.instrumentation'
import type {
  MediaInstrumentationEvent,
  MediaInstrumentationPayload,
} from '#/features/media/media.instrumentation'

describe('MEDIA_INSTRUMENTATION_EVENTS', () => {
  test('includes the spec events for all 6 screens', () => {
    const required: MediaInstrumentationEvent[] = [
      'library_viewed',
      'upload_started',
      'asset_detail_viewed',
      'folder_opened',
      'preview_opened',
      'transcription_started',
    ]
    for (const event of required) {
      expect(MEDIA_INSTRUMENTATION_EVENTS).toContain(event)
    }
  })
})

describe('validateMediaPayload', () => {
  test('valid payload with id and count', () => {
    const payload: MediaInstrumentationPayload = { id: 'asset-123', count: 5 }
    expect(validateMediaPayload(payload)).toBeNull()
  })

  test('rejects empty id', () => {
    const payload: MediaInstrumentationPayload = { id: '' }
    expect(validateMediaPayload(payload)).toContain('non-empty')
  })

  test('rejects filename (PII leak)', () => {
    const payload = {
      id: 'asset-123',
      filename: 'Reading_Overview.mp4',
    } as MediaInstrumentationPayload
    expect(validateMediaPayload(payload)).toContain('filename')
  })

  test('rejects name (PII leak)', () => {
    const payload = { id: 'asset-123', name: 'Reading Overview' } as MediaInstrumentationPayload
    expect(validateMediaPayload(payload)).toContain('name')
  })

  test('rejects text (content leak — transcript text)', () => {
    const payload = { id: 'asset-123', text: 'እንደምን ደህና' } as MediaInstrumentationPayload
    expect(validateMediaPayload(payload)).toContain('text')
  })

  test('rejects tags (content leak)', () => {
    const payload = { id: 'asset-123', tags: ['TOEFL', 'Reading'] } as MediaInstrumentationPayload
    expect(validateMediaPayload(payload)).toContain('tags')
  })

  test('rejects transcript (content leak)', () => {
    const payload = {
      id: 'asset-123',
      transcript: 'full transcript text',
    } as MediaInstrumentationPayload
    expect(validateMediaPayload(payload)).toContain('transcript')
  })

  test('rejects non-number count', () => {
    const payload = { id: 'asset-123', count: 'five' } as unknown as MediaInstrumentationPayload
    expect(validateMediaPayload(payload)).toContain('number')
  })
})

describe('trackMediaEvent', () => {
  test('calls send when payload is valid', () => {
    const sent: Array<{ event: string; payload: MediaInstrumentationPayload }> = []
    trackMediaEvent('library_viewed', { id: 'org-1', count: 25 }, (event, payload) =>
      sent.push({ event, payload }),
    )
    expect(sent).toHaveLength(1)
    expect(sent[0].event).toBe('library_viewed')
  })

  test('does not call send when payload is invalid', () => {
    const sent: Array<{ event: string; payload: MediaInstrumentationPayload }> = []
    trackMediaEvent('library_viewed', { id: '' }, (event, payload) => sent.push({ event, payload }))
    expect(sent).toHaveLength(0)
  })
})

describe('MEDIA_PERFORMANCE_BUDGETS', () => {
  test('library first paint budget is 1500ms', () => {
    expect(MEDIA_PERFORMANCE_BUDGETS.library_first_paint_25_cards).toBe(1500)
  })

  test('upload progress starts budget is 1000ms', () => {
    expect(MEDIA_PERFORMANCE_BUDGETS.upload_progress_starts).toBe(1000)
  })

  test('preview modal shell paint budget is 300ms', () => {
    expect(MEDIA_PERFORMANCE_BUDGETS.preview_modal_shell_paint).toBe(300)
  })
})

describe('breachesMediaBudget', () => {
  test('true when duration exceeds budget', () => {
    expect(breachesMediaBudget('library_first_paint_25_cards', 2000)).toBe(true)
  })

  test('false when duration is under budget', () => {
    expect(breachesMediaBudget('library_first_paint_25_cards', 1000)).toBe(false)
  })

  test('false when metric has no budget', () => {
    expect(breachesMediaBudget('unknown_metric', 99999)).toBe(false)
  })
})
