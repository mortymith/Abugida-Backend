import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from '#/components/common/toast'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Spinner } from '#/components/ui/spinner'
import { Badge } from '#/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { StatusPill } from './courses.status-pill'
import { MarkdownEditorSurface, useLessonEditor } from './courses.markdown-editor'
import { MarkdownToolbar } from './courses.markdown-toolbar'
import { MarkdownSourcePane } from './courses.markdown-source'
import { MarkdownPreview } from './courses.markdown-preview'
import { LegacyBodyNotice } from './courses.legacy-body-notice'
import { VIEW_MODE_HINTS, useLessonViewMode } from '../hooks/courses.markdown-views'
import type { LessonViewMode } from '../hooks/courses.markdown-views'
import { LESSON_AUTOSAVE_IDLE_MS, useLessonAutosave } from '../hooks/courses.markdown-autosave'
import { courseQueryKeys } from '../hooks/courses.queries'
import { REVIEW_STATE_LABELS } from '../courses.review-state'
import { LESSON_MIN_TEXT_LENGTH, normalizeMarkdown, summarizeMarkdown } from '../courses.markdown'
import { LibraryAssetPicker } from '#/features/library'
import type { SaveLessonInput } from '../server/courses.lessons'
import type { LessonEditDTO } from '../server/courses.lessons.impl.server'
import type { AssetCategory } from '@abugida/database/catalog'

const SPLIT_UNDO_HINT =
  'Undo works per sync in split view. Switch to rich text for step-by-step undo.'

/**
 * S-2.7 Lesson Editor — two-column layout with a Markdown content editor.
 *
 * Content is stored as Markdown (spec 12). The surface offers rich / split /
 * preview views, the toolbar is grouped and accessible, and autosave runs on a
 * 60s idle timer with `Ctrl+S` to flush.
 *
 * SSR note (spec 12 § 3.4 / D-8): the Tiptap instance is created with
 * `immediatelyRender: false` and the body is applied *after* mount, because
 * `new Editor({ content, contentType: 'markdown' })` throws in a DOM-less
 * runtime whenever the Markdown parses to an empty document.
 *
 * Review gate (S-2.14): `in_review` locks editing and suspends autosave;
 * `changes_requested` shows reviewer comments with re-submit; `approved` shows
 * ready-to-publish.
 */
export function LessonEditor({
  courseId,
  lessonId,
  onOpenQuizBuilder,
  onOpenAiQuiz,
}: {
  courseId: string
  lessonId: string
  onOpenQuizBuilder: () => void
  onOpenAiQuiz: () => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { mode, setMode } = useLessonViewMode()

  const lesson = useQuery({
    queryKey: ['courses', 'lesson-edit', lessonId],
    queryFn: async () => {
      const { getLessonForEdit } = await import('../server/all')
      return getLessonForEdit({ data: { lessonPublicId: lessonId } })
    },
  })

  const [title, setTitle] = useState('')
  const [contentType, setContentType] = useState<LessonEditDTO['contentType']>('video')
  const [videoUrl, setVideoUrl] = useState('')
  const [assetId, setAssetId] = useState<string | null>(null)
  const [assetName, setAssetName] = useState<string | null>(null)
  const [mediaSource, setMediaSource] = useState<'library' | 'url'>('url')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [tagsDraft, setTagsDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [rowVersion, setRowVersion] = useState(1)
  const [hydrated, setHydrated] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerCategories, setPickerCategories] = useState<AssetCategory[]>(['video'])
  /** Mirrored Markdown, kept in sync with the editor and the source pane. */
  const [markdown, setMarkdown] = useState('')
  /** Non-null while the author is typing in the source pane. */
  const [sourceDraft, setSourceDraft] = useState<string | null>(null)

  const data = lesson.data
  const locked = data?.reviewStatus === 'in_review'
  const editable = !locked

  // `editable` is passed as a stable boolean rather than read inside the
  // callback so the editor is not rebuilt when the query object changes identity.
  const editor = useLessonEditor({
    editable: true,
    onUpdate: () => setDirty(true),
  })

  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])

  // Hydrate once, after mount. Markdown bodies go through `contentType:
  // 'markdown'`; legacy HTML bodies keep the previous path so an un-migrated
  // lesson still opens and saves (spec 12 § 5.2).
  useEffect(() => {
    if (hydrated || !data || !editor) return
    setTitle(data.title)
    setContentType(data.contentType)
    setVideoUrl(data.videoUrl ?? '')
    setAssetId(data.assetId ?? null)
    setAssetName(data.assetName)
    setMediaSource(data.assetId ? 'library' : 'url')
    setDurationMinutes(data.durationMinutes?.toString() ?? '')
    setTagsDraft(data.tags.join(', '))
    setRowVersion(data.rowVersion)

    const body = data.body ?? ''
    if (data.bodyFormat === 'markdown') {
      editor.commands.setContent(body, { contentType: 'markdown' })
    } else {
      editor.commands.setContent(body)
    }
    editor.setEditable(!(data.reviewStatus === 'in_review'))
    setMarkdown(normalizeMarkdown(editor.getMarkdown()))
    setHydrated(true)
  }, [hydrated, data, editor])

  // Mirror the editor's Markdown whenever it changes, so the stats, the preview
  // and the source pane all read the same canonical value.
  useEffect(() => {
    if (!editor || sourceDraft !== null) return
    const handler = () => setMarkdown(normalizeMarkdown(editor.getMarkdown()))
    editor.on('update', handler)
    return () => {
      editor.off('update', handler)
    }
  }, [editor, sourceDraft])

  const summary = useMemo(() => summarizeMarkdown(markdown), [markdown])

  const save = useMutation({
    mutationFn: async (input: SaveLessonInput) => {
      const { saveLesson } = await import('../server/all')
      return saveLesson({ data: input })
    },
    onSuccess: (result) => {
      setRowVersion(result.rowVersion)
      setDirty(false)
      void queryClient.invalidateQueries({ queryKey: ['courses', 'lesson-edit', lessonId] })
      void queryClient.invalidateQueries({ queryKey: courseQueryKeys.curriculum(courseId) })
    },
  })

  const buildInput = useCallback((): SaveLessonInput => {
    const body = sourceDraft !== null ? normalizeMarkdown(sourceDraft) : markdown
    return {
      lessonPublicId: lessonId,
      title: title.trim(),
      body: body === '' ? null : body,
      // Decision D-3: the literal makes a client that forgot `getMarkdown()`
      // fail at the boundary instead of writing HTML into a Markdown column.
      bodyFormat: 'markdown',
      contentType,
      videoUrl: mediaSource === 'url' && videoUrl.trim() ? videoUrl.trim() : null,
      assetId: mediaSource === 'library' ? assetId : null,
      durationMinutes: durationMinutes === '' ? null : Number(durationMinutes),
      tags: tagsDraft
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 10),
      expectedRowVersion: rowVersion,
    }
  }, [
    contentType,
    durationMinutes,
    lessonId,
    markdown,
    mediaSource,
    rowVersion,
    sourceDraft,
    tagsDraft,
    title,
    videoUrl,
    assetId,
  ])

  const autosave = useLessonAutosave({
    enabled: editable,
    dirty,
    save: async () => {
      await save.mutateAsync(buildInput())
    },
  })

  // Surface mutation failures once, as a toast, whichever path triggered them.
  useEffect(() => {
    if (!save.isError) return
    const message = save.error instanceof Error ? save.error.message : 'Save failed'
    if (message.includes('LOCKED_IN_REVIEW')) {
      toast.error('A reviewer is looking at this lesson — editing is locked.')
    } else if (message.includes('VERSION_CONFLICT')) {
      toast.error('This lesson was updated elsewhere. Reload to continue.')
    } else {
      toast.error(message.replace(/^[A-Z_]+:\s*/, ''))
    }
  }, [save.isError, save.error])

  const submitReview = useMutation({
    mutationFn: async () => {
      const { submitLessonForReview } = await import('../server/all')
      return submitLessonForReview({ data: { lessonPublicId: lessonId } })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['courses', 'lesson-edit', lessonId] })
      toast.success('Submitted for review.')
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Submit failed'),
  })

  function openPicker(categories: AssetCategory[]) {
    setPickerCategories(categories)
    setPickerOpen(true)
  }

  function handleSourceChange(value: string) {
    setSourceDraft(value)
    setMarkdown(normalizeMarkdown(value))
    setDirty(true)
    if (!editor) return
    // The Markdown extension parses the string and replaces the document; undo
    // history resets per sync, which spec 12 § 7.1 documents and accepts.
    editor.commands.setContent(value, { contentType: 'markdown' })
  }

  function handlePullFromEditor() {
    if (!editor) return
    const next = normalizeMarkdown(editor.getMarkdown())
    setSourceDraft(null)
    setMarkdown(next)
    setDirty(true)
  }

  function handleModeChange(next: LessonViewMode) {
    // Leaving source view commits its text; the editor already holds it, but the
    // draft must be released so `buildInput` stops preferring it.
    if (next !== 'split' && sourceDraft !== null) setSourceDraft(null)
    setMode(next)
  }

  if (lesson.isPending) {
    return <Spinner className="mx-auto my-12" />
  }
  if (lesson.isError || !data) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Unable to load this lesson.</p>
        <Button variant="link" onClick={() => void lesson.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  const changesRequested = data.reviewStatus === 'changes_requested'
  const approved = data.reviewStatus === 'approved'
  const reviewGate = data.requiresApproval
  const isLegacy = data.bodyFormat === 'html'
  const disabledReason = locked
    ? 'Locked while this lesson is in review'
    : 'You do not have permission to edit this lesson'

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
            <Link to="/courses" className="hover:underline">
              Courses
            </Link>{' '}
            /{' '}
            <Link
              to="/courses/$courseId"
              params={{ courseId: courseId }}
              className="hover:underline"
            >
              {data.courseTitle}
            </Link>{' '}
            / {data.moduleTitle}
          </nav>
          <h1 className="font-display text-2xl font-bold">Edit Lesson</h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone={data.reviewStatus} label={REVIEW_STATE_LABELS[data.reviewStatus]} />
          {reviewGate && data.reviewStatus !== 'in_review' && data.reviewStatus !== 'approved' ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => submitReview.mutate()}
              disabled={submitReview.isPending}
            >
              Submit for Review
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close lesson editor"
            onClick={() =>
              dirty
                ? setConfirmClose(true)
                : void navigate({ to: '/courses/$courseId', params: { courseId: courseId } })
            }
          >
            ✕
          </Button>
        </div>
      </header>

      {locked ? (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          role="status"
        >
          This lesson is <strong>in review</strong> — editing is locked and the reviewer checklist
          is active. You will be notified of the decision.
        </div>
      ) : null}
      {changesRequested && data.reviewComments ? (
        <div
          className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm dark:border-orange-700 dark:bg-orange-950"
          role="alert"
        >
          <p className="font-medium">Reviewer requested changes:</p>
          <p>{data.reviewComments}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Edit the lesson, then re-submit for review.
          </p>
        </div>
      ) : null}
      {approved ? (
        <div
          className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200"
          role="status"
        >
          Approved — ready to publish. Publishing happens from the course wizard (S-2.5).
        </div>
      ) : null}
      {isLegacy ? <LegacyBodyNotice lessonTitle={data.title} /> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="rounded-xl border bg-card p-4 shadow-sm" aria-label="Content editor">
          <Input
            className="mb-3 text-lg font-semibold"
            value={title}
            aria-label="Lesson title"
            onChange={(event) => {
              setTitle(event.target.value)
              setDirty(true)
            }}
            disabled={locked}
            minLength={3}
          />

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <Tabs value={mode} onValueChange={(next) => handleModeChange(next as LessonViewMode)}>
              <TabsList aria-label="Lesson editor view">
                <TabsTrigger value="rich">Rich text</TabsTrigger>
                <TabsTrigger value="split">Split</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
            </Tabs>
            <SaveIndicator status={autosave.status} savedAt={autosave.savedAt} />
          </div>

          <MarkdownToolbar
            editor={editor}
            editable={editable}
            disabledReason={disabledReason}
            onInsertTable={() =>
              editor?.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()
            }
          />

          {mode === 'preview' ? (
            <div className="mt-2 min-h-64 rounded-lg border p-3">
              <MarkdownPreview markdown={markdown} />
            </div>
          ) : (
            <div
              className={
                mode === 'split' ? 'mt-2 grid gap-2 md:grid-cols-2' : 'mt-2 flex flex-col gap-2'
              }
            >
              <MarkdownEditorSurface
                editor={editor}
                editable={editable}
                label="Lesson content"
                className="min-h-64 rounded-lg border p-3 text-sm"
              />
              {mode === 'split' ? (
                <div className="flex flex-col gap-2">
                  <MarkdownSourcePane
                    value={sourceDraft ?? markdown}
                    onChange={handleSourceChange}
                    readOnly={locked}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePullFromEditor}
                      disabled={locked}
                    >
                      Pull from visual editor
                    </Button>
                    <p className="text-xs text-muted-foreground">{SPLIT_UNDO_HINT}</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <p className="mt-2 text-xs text-muted-foreground">{VIEW_MODE_HINTS[mode]}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground" data-testid="lesson-content-stats">
              {summary.wordCount} words · {summary.textLength} characters
              {summary.textLength < LESSON_MIN_TEXT_LENGTH ? ' (50 minimum)' : ''}
            </p>
            {summary.imageCount > 0 ? (
              <Badge variant="secondary">{summary.imageCount} images</Badge>
            ) : null}
            {summary.tableCount > 0 ? (
              <Badge variant="secondary">{summary.tableCount} tables</Badge>
            ) : null}
            {summary.taskCount > 0 ? (
              <Badge variant="secondary">{summary.taskCount} tasks</Badge>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onOpenQuizBuilder}>
              + Add Quiz
            </Button>
            <Button variant="secondary" size="sm" onClick={onOpenAiQuiz}>
              ✨ AI Quiz
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title={
                contentType === 'video' && mediaSource === 'library' && assetId
                  ? 'Open the transcription & subtitle editor'
                  : 'Captions need a video from the Content Library (Library media source)'
              }
              disabled={locked || contentType !== 'video' || mediaSource !== 'library' || !assetId}
              onClick={() => {
                if (!assetId) return
                void navigate({
                  to: '/content-library/$assetId/transcript',
                  params: { assetId },
                  search: { returnTo: window.location.pathname },
                })
              }}
            >
              Captions &amp; transcript
            </Button>
          </div>
        </section>

        <aside
          className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm"
          aria-label="Lesson settings"
        >
          <div>
            <Label htmlFor="lesson-type">Lesson Type</Label>
            <select
              id="lesson-type"
              className="h-9 w-full rounded-lg border bg-input/30 px-3 text-sm"
              value={contentType}
              disabled={locked}
              onChange={(event) => {
                setContentType(event.target.value as LessonEditDTO['contentType'])
                setDirty(true)
              }}
            >
              <option value="video">Video</option>
              <option value="pdf">PDF</option>
              <option value="quiz">Quiz</option>
              <option value="exercise">Exercise</option>
              <option value="link">Link</option>
            </select>
          </div>

          {contentType === 'video' || contentType === 'pdf' ? (
            <div>
              <Label>Media source</Label>
              <div className="mb-1 flex gap-1" role="tablist" aria-label="Media source">
                <Button
                  type="button"
                  variant={mediaSource === 'library' ? 'default' : 'outline'}
                  size="xs"
                  role="tab"
                  aria-selected={mediaSource === 'library'}
                  disabled={locked}
                  onClick={() => {
                    setMediaSource('library')
                    setDirty(true)
                  }}
                >
                  Library
                </Button>
                <Button
                  type="button"
                  variant={mediaSource === 'url' ? 'default' : 'outline'}
                  size="xs"
                  role="tab"
                  aria-selected={mediaSource === 'url'}
                  disabled={locked}
                  onClick={() => {
                    setMediaSource('url')
                    setDirty(true)
                  }}
                >
                  {contentType === 'video' ? 'YouTube/Vimeo' : 'PDF URL'}
                </Button>
              </div>
              {mediaSource === 'library' ? (
                <div className="flex flex-col gap-1">
                  {assetId ? (
                    <p
                      className="truncate rounded bg-muted px-2 py-1 text-sm"
                      title={assetName ?? ''}
                    >
                      {assetName ?? assetId}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={locked}
                    onClick={() => openPicker(contentType === 'video' ? ['video'] : ['document'])}
                  >
                    {assetId ? 'Change library asset' : 'Choose from Library'}
                  </Button>
                </div>
              ) : contentType === 'video' ? (
                <Input
                  id="lesson-video"
                  value={videoUrl}
                  placeholder="https://youtube.com/…"
                  onChange={(event) => {
                    setVideoUrl(event.target.value)
                    setDirty(true)
                  }}
                  disabled={locked}
                />
              ) : null}
            </div>
          ) : null}

          <div>
            <Label htmlFor="lesson-duration">Duration (minutes)</Label>
            <Input
              id="lesson-duration"
              type="number"
              min="1"
              value={durationMinutes}
              onChange={(event) => {
                setDurationMinutes(event.target.value)
                setDirty(true)
              }}
              disabled={locked}
            />
          </div>

          <div>
            <Label htmlFor="lesson-tags">Tags (comma-separated, for search)</Label>
            <Input
              id="lesson-tags"
              value={tagsDraft}
              placeholder="TOEFL, Introduction"
              onChange={(event) => {
                setTagsDraft(event.target.value)
                setDirty(true)
              }}
              disabled={locked}
            />
          </div>

          <div className="mt-auto flex justify-end gap-2">
            <Button
              variant="ghost"
              disabled={!dirty || locked}
              onClick={() => setConfirmClose(true)}
            >
              Revert
            </Button>
            <Button
              disabled={locked || save.isPending || !dirty}
              onClick={() => {
                void autosave.flush().then((ok) => {
                  if (ok) toast.success('Lesson saved successfully.')
                })
              }}
            >
              {save.isPending ? <Spinner className="size-4" /> : null}
              Save
            </Button>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            Autosaves after {Math.round(LESSON_AUTOSAVE_IDLE_MS / 1000)}s idle, or press Ctrl+S.
          </p>
        </aside>
      </div>

      <LibraryAssetPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        categories={pickerCategories}
        onSelect={(asset) => {
          setAssetId(asset.publicId)
          setAssetName(asset.name)
          setMediaSource('library')
          setDirty(true)
        }}
      />

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Leave without saving?"
        body="You have unsaved changes to this lesson."
        confirmLabel="Discard changes"
        destructive
        onConfirm={() => {
          setConfirmClose(false)
          setDirty(false)
          void navigate({ to: '/courses/$courseId', params: { courseId: courseId } })
        }}
      />
    </div>
  )
}

function SaveIndicator({
  status,
  savedAt,
}: {
  status: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
  savedAt: Date | null
}) {
  const text =
    status === 'saving'
      ? 'Saving…'
      : status === 'error'
        ? 'Save failed — retry'
        : status === 'dirty'
          ? 'Unsaved changes'
          : status === 'saved' && savedAt
            ? `All changes saved at ${savedAt.toLocaleTimeString()}`
            : 'All changes saved'
  return (
    <p
      className="text-xs text-muted-foreground"
      aria-live="polite"
      role="status"
      data-testid="lesson-save-indicator"
    >
      {text}
    </p>
  )
}
