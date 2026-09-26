import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft01Icon, SparklesIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { Spinner } from '#/components/ui/spinner'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { useRole } from '#/features/auth'
import { canEditLibrary } from '#/features/library/library.permissions'
import { getAssetReadUrl } from '#/features/library/server/all'
import { parseLibraryReturnTo } from '#/features/library/library.return-to'
import { transcriptQueryOptions, libraryQueryKeys } from '#/features/library/hooks/library.queries'
import type { TranscriptDTO } from '#/features/library/library.types'
import {
  formatClock,
  longLineWarnings,
  parseClock,
  snapToFreeGap,
  validateMonotonic,
} from '#/features/library/library.transcript-logic'
import { toSrt, toVtt } from '#/features/library/library.srt'

export const Route = createFileRoute('/_app/content-library/$assetId/transcript')({
  // `returnTo` arrives from the URL, so it is narrowed to the two screens S-3.6
  // is allowed to return to (S-2.7 lesson editor / S-3.3 asset detail).
  // Anything else — an absolute URL, a protocol-relative host, a traversal —
  // degrades to `undefined` so "Save & Apply" stays on the editor.
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: parseLibraryReturnTo(search.returnTo),
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(transcriptQueryOptions(params.assetId, 'en')),
  component: TranscriptEditorPage,
})

interface EditableSegment {
  key: string
  startMs: number
  endMs: number
  speaker: string
  text: string
}

const AUTOSAVE_INTERVAL_MS = 30_000

function TranscriptEditorPage() {
  const { assetId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const role = useRole()
  // S-3.6 is an Admin/Editor authoring screen. The route sits under
  // /content-library, which Reviewer/Viewer may read, so the editor controls
  // have to be gated here too — otherwise every save came back FORBIDDEN.
  const canEdit = canEditLibrary(role)
  const queryClient = useQueryClient()

  const transcript = useQuery(transcriptQueryOptions(assetId, 'en'))
  const [language, setLanguage] = useState('en')
  const languageQuery = useQuery({
    ...transcriptQueryOptions(assetId, language),
    enabled: language !== 'en',
  })
  const data = language === 'en' ? transcript.data : languageQuery.data
  /** The query for the language actually on screen — not always the 'en' one. */
  const activeQuery = language === 'en' ? transcript : languageQuery

  const [segments, setSegments] = useState<EditableSegment[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [captionStyle, setCaptionStyle] = useState<TranscriptDTOStyle | null>(null)
  const [showByDefault, setShowByDefault] = useState(true)
  const [currentMs, setCurrentMs] = useState(0)
  const [ccOn, setCcOn] = useState(true)
  const [readUrl, setReadUrl] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const videoRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (hydrated || !data) return
    setSegments(
      data.segments.map((segment, index) => ({
        key: `seg-${index}-${segment.segmentIndex}`,
        startMs: segment.startMs,
        endMs: segment.endMs,
        speaker: segment.speaker ?? '',
        text: segment.text,
      })),
    )
    setCaptionStyle(data.captionStyle)
    setShowByDefault(data.showByDefault)
    setHydrated(true)
  }, [data, hydrated])

  useEffect(() => {
    let active = true
    getAssetReadUrl({ data: { assetPublicId: assetId, disposition: 'inline' } })
      .then((result) => {
        if (active) setReadUrl(result.url)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [assetId])

  const asSegmentLikes = () =>
    segments.map((segment, index) => ({ ...segment, segmentIndex: index }))
  const issues = useMemo(() => validateMonotonic(asSegmentLikes()), [segments])
  const warnings = useMemo(
    () =>
      longLineWarnings(
        segments.map((segment, index) => ({ segmentIndex: index, text: segment.text })),
      ),
    [segments],
  )

  const buildSaveInput = useCallback(
    (status: 'draft' | 'published') => ({
      assetPublicId: assetId,
      language,
      segments: segments
        .map((segment, index) => ({
          segmentIndex: index,
          startMs: Math.round(segment.startMs),
          endMs: Math.round(segment.endMs),
          speaker: segment.speaker.trim() || null,
          text: segment.text.trim(),
        }))
        .filter((segment) => segment.text !== ''),
      captionStyle,
      showByDefault,
      status,
      source: data?.source ?? 'manual',
    }),
    [assetId, language, segments, captionStyle, showByDefault, data?.source],
  )

  const save = useCallback(
    async (status: 'draft' | 'published') => {
      if (issues.length > 0) {
        toast.error(`Fix timing issues first: ${issues[0]?.message}`)
        return
      }
      const { saveTranscript } = await import('#/features/library/server/all')
      try {
        await saveTranscript({ data: buildSaveInput(status) })
        setDirty(false)
        setLastSavedAt(new Date())
        if (status === 'published') {
          toast.success('Captions applied to lesson.')
          // Spec S-3.6: "Save & Apply" returns to the calling screen.
          // `search.returnTo` is allow-listed by validateSearch.
          if (search.returnTo) {
            void navigate({ to: search.returnTo })
            return
          }
        } else {
          toast.success('Draft saved.')
        }
        void activeQuery.refetch()
      } catch (cause) {
        toast.error(
          cause instanceof Error
            ? cause.message.replace(/^[A-Z_]+:\s*/, '')
            : 'Unable to save the transcript.',
        )
      }
    },
    [activeQuery, buildSaveInput, issues, navigate, search.returnTo],
  )

  // Autosave draft every 30s while dirty (spec S-3.6 editing state).
  useEffect(() => {
    if (!dirty || generating || !canEdit) return
    const timer = setInterval(() => {
      void save('draft')
    }, AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [canEdit, dirty, generating, save])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (canEdit) void save('draft')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canEdit, save])

  if (transcript.isPending) return <Spinner className="mx-auto my-12" />
  if (transcript.isError) {
    return (
      <RetryErrorState
        title="Unable to load the transcript. Retry?"
        onRetry={() => void transcript.refetch()}
        isRetrying={transcript.isRefetching}
      />
    )
  }

  const asset = transcript.data

  function seek(ms: number) {
    const media = videoRef.current
    if (media) {
      media.currentTime = ms / 1000
      void media.play().catch(() => undefined)
    }
    setCurrentMs(ms)
  }

  function updateSegment(key: string, patch: Partial<EditableSegment>) {
    setSegments((previous) =>
      previous.map((segment) => (segment.key === key ? { ...segment, ...patch } : segment)),
    )
    setDirty(true)
  }

  function updateTimingWithSnap(key: string, startMs: number, endMs: number) {
    const index = segments.findIndex((segment) => segment.key === key)
    if (index < 0) return
    const snapped = snapToFreeGap(asSegmentLikes(), index, startMs, endMs)
    if (snapped == null) {
      toast.error('No free gap for this timing — adjust neighbouring segments first.')
      return
    }
    updateSegment(key, snapped)
  }

  function addSegment(afterKey: string | null) {
    setSegments((previous) => {
      const index =
        afterKey == null
          ? previous.length
          : previous.findIndex((segment) => segment.key === afterKey)
      const anchor = index >= 0 ? previous[index] : undefined
      const startMs = anchor ? anchor.endMs : 0
      const insertAt = index + 1
      const next = [...previous]
      next.splice(insertAt, 0, {
        key: `seg-new-${Date.now()}`,
        startMs,
        endMs: startMs + 2_000,
        speaker: '',
        text: '',
      })
      return next
    })
    setDirty(true)
  }

  function deleteSegment(key: string) {
    setSegments((previous) => previous.filter((segment) => segment.key !== key))
    setDirty(true)
  }

  async function autoTranscribe(rangeMs?: { start: number; end: number }) {
    if (!canEdit) return
    setGenerating(true)
    try {
      const { generateTranscription, regenerateTranscriptRange } =
        await import('#/features/library/server/all')
      if (rangeMs) {
        await regenerateTranscriptRange({
          data: {
            assetPublicId: assetId,
            language,
            rangeStartMs: rangeMs.start,
            rangeEndMs: rangeMs.end,
          },
        })
      } else {
        await generateTranscription({ data: { assetPublicId: assetId, language } })
      }
      setHydrated(false)
      setDirty(false)
      // Refresh the track actually on screen — `transcript` is only the 'en'
      // query, so refetching it left a non-English language showing stale cues.
      await activeQuery.refetch()
      toast.success('Transcription drafted — review and edit before applying.')
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message.replace(/^[A-Z_]+:\s*/, '')
          : 'Transcription failed.',
      )
    } finally {
      setGenerating(false)
    }
  }

  async function importFile(file: File) {
    if (!canEdit) return
    const content = await file.text()
    const { importTranscriptFile } = await import('#/features/library/server/all')
    try {
      const result = await importTranscriptFile({
        data: { assetPublicId: assetId, language, content, fileName: file.name },
      })
      if (!result.ok) {
        toast.error(
          `Import failed: ${result.issues
            .slice(0, 3)
            .map((issue) => `line ${issue.line} — ${issue.message}`)
            .join('; ')}`,
        )
        return
      }
      setHydrated(false)
      setDirty(false)
      await activeQuery.refetch()
      toast.success(`Imported ${result.segmentCount} segments as a draft.`)
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message.replace(/^[A-Z_]+:\s*/, '') : 'Import failed.',
      )
    }
  }

  async function translate(toLanguage: string) {
    if (!canEdit) return
    const { translateTranscript } = await import('#/features/library/server/all')
    try {
      const result = await translateTranscript({
        data: { assetPublicId: assetId, fromLanguage: language, toLanguage },
      })
      // Drop any cached copy of the target track first: a stale entry would be
      // re-hydrated into the editor (hydrated was just reset) before a refetch
      // resolved, leaving the previous translation on screen. Removing (rather
      // than invalidating) also guarantees a `data === undefined` render in
      // between, which is what stops the hydration effect from latching.
      queryClient.removeQueries({
        queryKey: libraryQueryKeys.transcript(assetId, result.language),
        exact: true,
      })
      setLanguage(result.language)
      setHydrated(false)
      if (result.language === 'en') {
        await transcript.refetch()
      } else {
        await queryClient.fetchQuery(transcriptQueryOptions(assetId, result.language))
      }
      toast.success(`Translated ${result.segmentCount} segments into a new draft track.`)
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message.replace(/^[A-Z_]+:\s*/, '') : 'Translation failed.',
      )
    }
  }

  function exportTrack(format: 'srt' | 'vtt') {
    const cues = segments
      .filter((segment) => segment.text.trim() !== '')
      .map((segment) => ({ startMs: segment.startMs, endMs: segment.endMs, text: segment.text }))
    if (cues.length === 0) {
      toast.error('Nothing to export yet.')
      return
    }
    const content = format === 'srt' ? toSrt(cues) : toVtt(cues)
    const base = asset.assetName.replace(/\.[a-z0-9]{1,8}$/i, '') || 'transcript'
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${base}.${language}.${format}`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const activeSegment = segments.find(
    (segment) => currentMs >= segment.startMs && currentMs < segment.endMs,
  )

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to asset"
            onClick={() => window.history.back()}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden="true" />
          </Button>
          <h1 className="truncate font-display text-xl font-bold">
            Transcription — {asset.assetName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportTrack('srt')}>
            Export .srt
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportTrack('vtt')}>
            Export .vtt
          </Button>
        </div>
      </header>

      {generating ? (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm" role="status">
          <Spinner className="mr-2 inline size-4" />
          Generating transcript… the editor stays readable but is locked from edits. This can take a
          minute.
        </div>
      ) : null}
      {issues.length > 0 ? (
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {issues.length} timing issue{issues.length === 1 ? '' : 's'} — {issues[0]?.message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3" aria-label="Player">
          <div className="relative overflow-hidden rounded-xl border bg-black">
            {readUrl && asset.assetMimeType?.startsWith('video/') ? (
              <video
                ref={(node) => {
                  videoRef.current = node
                }}
                src={readUrl}
                controls
                className="aspect-video w-full"
                onTimeUpdate={(event) => setCurrentMs(event.currentTarget.currentTime * 1000)}
              >
                <track kind="captions" />
              </video>
            ) : readUrl && asset.assetMimeType?.startsWith('audio/') ? (
              <audio
                ref={(node) => {
                  videoRef.current = node
                }}
                src={readUrl}
                controls
                className="w-full p-8"
                onTimeUpdate={(event) => setCurrentMs(event.currentTarget.currentTime * 1000)}
              >
                <track kind="captions" />
              </audio>
            ) : (
              <div className="flex aspect-video items-center justify-center p-4 text-sm text-muted-foreground">
                Preview not available. Download to view.
              </div>
            )}
            {ccOn && activeSegment ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-4"
                aria-live="polite"
              >
                <p
                  className={`rounded px-3 py-1 text-center leading-snug ${
                    captionStyle?.background === 'none'
                      ? ''
                      : captionStyle?.background === 'opaque'
                        ? 'bg-black/90'
                        : 'bg-black/60'
                  } text-white`}
                  style={{ fontSize: `${captionStyle?.fontSizePx ?? 16}px` }}
                >
                  {activeSegment.text}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button
              variant={ccOn ? 'default' : 'outline'}
              size="xs"
              aria-pressed={ccOn}
              onClick={() => setCcOn((value) => !value)}
            >
              CC {ccOn ? 'On' : 'Off'}
            </Button>
            <span className="tabular-nums text-muted-foreground">{formatClock(currentMs)}</span>
            <span className="flex-1" />
            <label className="flex items-center gap-1">
              Language
              <select
                value={language}
                className="h-8 rounded-lg border bg-input/30 px-2 text-sm"
                aria-label="Transcript language"
                onChange={(event) => {
                  setLanguage(event.target.value)
                  setHydrated(false)
                }}
              >
                {Array.from(new Set([...asset.availableLanguages, language])).map((available) => (
                  <option key={available} value={available}>
                    {available.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={generating || !canEdit}
              onClick={() => void autoTranscribe()}
            >
              <HugeiconsIcon icon={SparklesIcon} className="size-4" aria-hidden="true" />
              Auto-Transcribe
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={generating || !canEdit}
              onClick={() => fileInputRef.current?.click()}
            >
              Import .srt/.vtt
            </Button>
            <select
              aria-label="Translate track to"
              defaultValue=""
              disabled={!canEdit}
              className="h-8 rounded-lg border bg-input/30 px-2 text-sm"
              onChange={(event) => {
                const target = event.target.value
                event.target.value = ''
                if (target) void translate(target)
              }}
            >
              <option value="" disabled>
                Translate ▾
              </option>
              {['am', 'om', 'ti', 'sw', 'fr', 'ar', 'es'].map((code) => (
                <option key={code} value={code}>
                  → {code.toUpperCase()}
                </option>
              ))}
            </select>
            <input
              ref={fileInputRef}
              type="file"
              accept=".srt,.vtt"
              className="sr-only"
              aria-label="Import subtitle file"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void importFile(file)
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {canEdit
              ? 'Auto-Transcribe requires a configured speech-to-text provider (TRANSCRIPTION_API_KEY). Import and manual editing always work.'
              : 'Read-only access — transcription authoring requires the Editor or Admin role.'}
          </p>
        </section>

        <section className="flex flex-col gap-2" aria-label="Segments">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Segments ({segments.length})</h2>
            <Button
              variant="outline"
              size="xs"
              disabled={generating || !canEdit}
              onClick={() => addSegment(null)}
            >
              + Add segment
            </Button>
          </div>
          <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
            {segments.map((segment) => {
              const index = segments.indexOf(segment)
              const warning = warnings.find((entry) => entry.segmentIndex === index)
              return (
                <li key={segment.key} className="rounded-lg border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs hover:bg-accent"
                      onClick={() => seek(segment.startMs)}
                      aria-label={`Seek to ${formatClock(segment.startMs)}`}
                    >
                      {formatClock(segment.startMs)}
                    </button>
                    <input
                      type="text"
                      // `key` carries the value: these are uncontrolled inputs,
                      // so without it a snapped timing (or a language switch,
                      // which reuses the same `seg-i-j` keys) left the box
                      // showing the pre-edit time.
                      key={`${segment.key}:${segment.startMs}`}
                      defaultValue={formatClock(segment.startMs)}
                      readOnly={!canEdit}
                      className="w-16 rounded border bg-input/30 px-1 font-mono text-xs"
                      aria-label="Start time"
                      onBlur={(event) => {
                        const parsed = parseClock(event.target.value)
                        if (parsed == null) {
                          event.target.value = formatClock(segment.startMs)
                          return
                        }
                        updateTimingWithSnap(segment.key, parsed, segment.endMs)
                      }}
                    />
                    <span aria-hidden="true" className="text-xs text-muted-foreground">
                      →
                    </span>
                    <input
                      type="text"
                      key={`${segment.key}:${segment.endMs}`}
                      defaultValue={formatClock(segment.endMs)}
                      readOnly={!canEdit}
                      className="w-16 rounded border bg-input/30 px-1 font-mono text-xs"
                      aria-label="End time"
                      onBlur={(event) => {
                        const parsed = parseClock(event.target.value)
                        if (parsed == null) {
                          event.target.value = formatClock(segment.endMs)
                          return
                        }
                        updateTimingWithSnap(segment.key, segment.startMs, parsed)
                      }}
                    />
                    <input
                      type="text"
                      key={`${segment.key}:${segment.speaker}`}
                      defaultValue={segment.speaker}
                      readOnly={!canEdit}
                      placeholder="Speaker"
                      className="w-24 rounded border bg-input/30 px-1 text-xs"
                      aria-label="Speaker"
                      onBlur={(event) =>
                        updateSegment(segment.key, { speaker: event.target.value })
                      }
                    />
                    <span className="flex-1" />
                    {warning ? (
                      <span
                        className="text-xs text-amber-600 dark:text-amber-400"
                        title={warning.message}
                        aria-label={warning.message}
                      >
                        ⚠
                      </span>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Delete segment"
                      disabled={generating || !canEdit}
                      onClick={() => deleteSegment(segment.key)}
                    >
                      ✕
                    </Button>
                  </div>
                  <textarea
                    value={segment.text}
                    rows={2}
                    className="mt-1 w-full resize-y rounded border bg-input/30 px-2 py-1 text-sm"
                    aria-label="Segment text"
                    disabled={generating || !canEdit}
                    onChange={(event) => updateSegment(segment.key, { text: event.target.value })}
                  />
                  {canEdit ? (
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={() => addSegment(segment.key)}
                      >
                        + Add after
                      </button>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={() =>
                          void autoTranscribe({
                            start: segment.startMs,
                            end: segment.endMs,
                          })
                        }
                        disabled={generating}
                      >
                        ↻ Regenerate this range
                      </button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      <footer className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="caption-font">Caption font</Label>
          <select
            id="caption-font"
            value={captionStyle?.font ?? 'inter'}
            disabled={!canEdit}
            className="h-8 rounded-lg border bg-input/30 px-2 text-sm"
            onChange={(event) => {
              setCaptionStyle({
                font: event.target.value as 'inter' | 'system' | 'serif' | 'mono',
                fontSizePx: captionStyle?.fontSizePx ?? 16,
                background: captionStyle?.background ?? 'semi',
              })
              setDirty(true)
            }}
          >
            <option value="inter">Inter</option>
            <option value="system">System</option>
            <option value="serif">Serif</option>
            <option value="mono">Mono</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="caption-size">Size</Label>
          <select
            id="caption-size"
            value={captionStyle?.fontSizePx ?? 16}
            disabled={!canEdit}
            className="h-8 rounded-lg border bg-input/30 px-2 text-sm"
            onChange={(event) => {
              setCaptionStyle({
                font: captionStyle?.font ?? 'inter',
                fontSizePx: Number(event.target.value) as 14 | 16 | 18 | 20,
                background: captionStyle?.background ?? 'semi',
              })
              setDirty(true)
            }}
          >
            {[14, 16, 18, 20].map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="caption-bg">Background</Label>
          <select
            id="caption-bg"
            value={captionStyle?.background ?? 'semi'}
            disabled={!canEdit}
            className="h-8 rounded-lg border bg-input/30 px-2 text-sm"
            onChange={(event) => {
              setCaptionStyle({
                font: captionStyle?.font ?? 'inter',
                fontSizePx: captionStyle?.fontSizePx ?? 16,
                background: event.target.value as 'none' | 'semi' | 'opaque',
              })
              setDirty(true)
            }}
          >
            <option value="none">Transparent</option>
            <option value="semi">Semi-transparent</option>
            <option value="opaque">Opaque</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showByDefault}
            disabled={!canEdit}
            onChange={(event) => {
              setShowByDefault(event.target.checked)
              setDirty(true)
            }}
            className="size-4 accent-primary"
          />
          Show captions by default
        </label>
        <span className="flex-1" />
        {dirty ? (
          <span className="text-xs text-muted-foreground">
            Unsaved changes — autosaves every 30s
          </span>
        ) : lastSavedAt ? (
          <span className="text-xs text-muted-foreground">
            Saved {lastSavedAt.toLocaleTimeString()}
          </span>
        ) : null}
        {canEdit ? (
          <>
            <Button
              variant="ghost"
              disabled={!dirty || generating}
              onClick={() => void save('draft')}
            >
              Save draft
            </Button>
            <Button disabled={generating} onClick={() => void save('published')}>
              Save &amp; Apply to Lesson
            </Button>
          </>
        ) : null}
      </footer>
      {search.returnTo ? (
        <p className="text-xs text-muted-foreground">Return target: {search.returnTo}</p>
      ) : null}
    </div>
  )
}

type TranscriptDTOStyle = NonNullable<TranscriptDTO['captionStyle']>
