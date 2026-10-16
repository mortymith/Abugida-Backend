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
import { OfflineBanner } from '#/components/common/offline-banner'
import { StatusPill } from './courses.status-pill'
import { MarkdownEditorSurface, useLessonEditor } from './courses.markdown-editor'
import { MarkdownToolbar } from './courses.markdown-toolbar'
import { MarkdownSourcePane } from './courses.markdown-source'
import { MarkdownPreview } from './courses.markdown-preview'
import { MarkdownConflictDialog } from './courses.markdown-conflict-dialog'
import { LegacyBodyNotice } from './courses.legacy-body-notice'
import { VIEW_MODE_HINTS, useLessonViewMode } from '../hooks/courses.markdown-views'
import type { LessonViewMode } from '../hooks/courses.markdown-views'
import { LESSON_AUTOSAVE_IDLE_MS, useLessonAutosave } from '../hooks/courses.markdown-autosave'
import { useLessonDraftMirror } from '../hooks/courses.markdown-draft-mirror'
import { useOnlineState } from '../hooks/courses.online-state'
import {
  clearQueuedSave,
  enqueueSave,
  readQueuedSave,
} from '../hooks/courses.markdown-offline-queue'
import { courseQueryKeys } from '../hooks/courses.queries'
import { REVIEW_STATE_LABELS } from '../courses.review-state'
import { LESSON_MIN_TEXT_LENGTH, normalizeMarkdown, summarizeMarkdown } from '../courses.markdown'
import { MediaAssetPicker } from '#/features/media'
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
  // Spec 12 § 8.1.2 — offline detection. The editor is the documented
  // exception to Part 11's "offline = read-only" rule: the canvas stays
  // editable because the IndexedDB mirror keeps taking writes every 1000ms.
  // What is suspended offline is the server write path, not the editor.
  const onlineState = useOnlineState()

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
  const [mediaSource, setMediaSource] = useState<'media' | 'url'>('url')
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
  /**
   * Spec 12 § 8.2 — three-option conflict state. `localRowVersion` is the
   * rowVersion the stale save was based on; `serverRowVersion` is what the
   * server reported back via the 409. `serverBody` is the server's Markdown
   * body for the diff view. The dialog is open while `conflict` is non-null.
   */
  const [conflict, setConflict] = useState<{
    localRowVersion: number
    serverRowVersion: number
    serverBody: string
  } | null>(null)

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

  // Spec 12 § 8.1.1 — IndexedDB draft mirror. Declared before the hydration
  // effect because hydration is gated on the restore-prompt state. The mirror
  // is the durability layer behind every session-expiry and reload guarantee:
  // an author who types for 40 seconds and closes the tab has an
  // in-memory-only buffer under the 60s autosave timer, and the mirror is what
  // recovers it. The hook also owns the `beforeunload` guard, which fires
  // whenever `dirty` is true regardless of the mirror.
  //
  // `markdown` and `title` are intentionally read live here: the hook debounces
  // writes to 1000ms, so this does not race the editor's update events.
  const draftMirror = useLessonDraftMirror({
    itemPublicId: lessonId,
    rowVersion,
    body: markdown,
    title,
    dirty,
    // Mirror only while the author can actually edit. A locked lesson has no
    // buffer to recover, and a Viewer/Reviewer has no save path. `hydrated`
    // gates the initial burst so we don't mirror the server body before the
    // author has touched anything.
    enabled: hydrated && editable,
  })

  // Hydrate once, after mount. Markdown bodies go through `contentType:
  // 'markdown'`; legacy HTML bodies keep the previous path so an un-migrated
  // lesson still opens and saves (spec 12 § 5.2).
  //
  // Spec 12 § 8.1.1: hydration is gated on the IndexedDB restore prompt. If a
  // draft exists at the current rowVersion, the editor must ask the author
  // Restore / Discard **before** hydrating from the server body. The prompt is
  // never silent and never auto-applied. A stale draft (rowVersion < server's)
  // routes to the conflict dialog and is handled in Phase A3.
  useEffect(() => {
    if (hydrated || !data || !editor) return
    // Wait until the mirror has finished its mount-time check.
    if (draftMirror.restore.kind === 'checking') return
    // A pending draft blocks hydration until the author picks Restore or
    // Discard. A stale draft routes to the conflict flow (Phase A3) and also
    // blocks hydration.
    if (draftMirror.restore.kind === 'pending' || draftMirror.restore.kind === 'stale') return

    setTitle(data.title)
    setContentType(data.contentType)
    setVideoUrl(data.videoUrl ?? '')
    setAssetId(data.assetId ?? null)
    setAssetName(data.assetName)
    setMediaSource(data.assetId ? 'media' : 'url')
    setDurationMinutes(data.durationMinutes?.toString() ?? '')
    setTagsDraft(data.tags.join(', '))

    const body = data.body ?? ''
    if (data.bodyFormat === 'markdown') {
      editor.commands.setContent(body, { contentType: 'markdown' })
    } else {
      editor.commands.setContent(body)
    }
    editor.setEditable(!(data.reviewStatus === 'in_review'))
    setMarkdown(normalizeMarkdown(editor.getMarkdown()))
    setHydrated(true)
  }, [hydrated, data, editor, draftMirror.restore])

  // Spec 12 § 8.1.1 — when the author accepts the restore prompt, hydrate
  // from the draft instead of the server body. The draft's Markdown is the
  // same string the editor would have produced, so the parse path is
  // identical and there is no second normalization to drift on.
  function handleRestoreAccept() {
    const draft = draftMirror.acceptRestore()
    if (!draft || !data || !editor) return
    setTitle(draft.title)
    setContentType(data.contentType)
    setVideoUrl(data.videoUrl ?? '')
    setAssetId(data.assetId ?? null)
    setAssetName(data.assetName)
    setMediaSource(data.assetId ? 'media' : 'url')
    setDurationMinutes(data.durationMinutes?.toString() ?? '')
    setTagsDraft(data.tags.join(', '))
    editor.commands.setContent(draft.body, { contentType: 'markdown' })
    editor.setEditable(!(data.reviewStatus === 'in_review'))
    setMarkdown(normalizeMarkdown(editor.getMarkdown()))
    setDirty(true)
    setHydrated(true)
  }

  // Spec 12 § 8.1.1 — Discard clears the mirror and proceeds with the server
  // body via the normal hydration effect (the mirror state transitions to
  // 'none', which unblocks the effect).
  async function handleRestoreDiscard() {
    await draftMirror.discardRestore()
  }

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
      // Spec 12 § 8.1.1 — clear the IndexedDB mirror only on a confirmed
      // save. A failed or conflicted save leaves the mirror intact, because
      // the work is not yet safe.
      void draftMirror.onConfirmedSave()
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
      assetId: mediaSource === 'media' ? assetId : null,
      durationMinutes: durationMinutes === '' ? null : Number(durationMinutes),
      tags: tagsDraft
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 10),
      expectedRowVersion: rowVersion,
      // Spec 12 § 14.1 — the 60s autosave timer does NOT write a body
      // revision. The editor's autosave path passes `source: 'autosave'` so
      // `saveLessonImpl` skips the revision write. Explicit Flush
      // (Ctrl/⌘+S) and context-switch flush pass `source: 'explicit'`.
      source: 'explicit',
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

  // Spec 12 § 14.1 — the autosave mutation carries `source: 'autosave'` so
  // `saveLessonImpl` skips the revision write. Explicit flushes (Ctrl/⌘+S
  // and context-switch) use the `buildInput()` above and write a revision.
  const buildAutosaveInput = useCallback((): SaveLessonInput => {
    const input = buildInput()
    return { ...input, source: 'autosave' }
  }, [buildInput])

  const autosave = useLessonAutosave({
    enabled: editable,
    dirty,
    online: onlineState.online,
    save: async () => {
      // Spec 12 § 8.1.2 — when offline, the hook reports `offline` and does
      // not call `save`. This branch only fires when online. The editor's
      // offline-queue helper (Phase A4) is invoked from a separate effect
      // that watches `online` and `dirty`.
      //
      // Spec 12 § 14.1 — the autosave path uses `buildAutosaveInput` so the
      // server skips the revision write. Explicit Flush (Ctrl/⌘+S) goes
      // through `save.mutateAsync(buildInput())` directly, with
      // `source: 'explicit'`, and writes a revision.
      await save.mutateAsync(buildAutosaveInput())
    },
  })

  // Spec 12 § 8.1.2 — offline queue. When the editor is offline and dirty,
  // enqueue the save rather than attempting it. On reconnect, flush the
  // queue in order; a stale rowVersion resolves to the three-option
  // conflict dialog (Phase A3), never a silent overwrite.
  useEffect(() => {
    if (onlineState.online || !dirty || !editable || !hydrated) return
    const input = buildInput()
    void enqueueSave({
      lessonPublicId: lessonId,
      body: input.body ?? '',
      bodyFormat: 'markdown',
      expectedRowVersion: input.expectedRowVersion,
      queuedAt: new Date().toISOString(),
      input: {
        title: input.title,
        contentType: input.contentType,
        videoUrl: input.videoUrl,
        durationMinutes: input.durationMinutes,
        tags: input.tags,
        assetId: input.assetId ?? null,
      },
    })
  }, [onlineState.online, dirty, editable, hydrated, lessonId, buildInput])

  // Flush the queue on reconnect. A 409 surfaces the conflict dialog via the
  // save error effect above; the queue entry is cleared on success.
  useEffect(() => {
    if (!onlineState.online || !hydrated) return
    void (async () => {
      const queued = await readQueuedSave(lessonId)
      if (!queued) return
      try {
        const { saveLesson } = await import('../server/all')
        await saveLesson({
          data: {
            lessonPublicId: queued.lessonPublicId,
            title: queued.input.title,
            body: queued.body === '' ? null : queued.body,
            bodyFormat: 'markdown',
            contentType: queued.input.contentType,
            videoUrl: queued.input.videoUrl,
            durationMinutes: queued.input.durationMinutes,
            tags: queued.input.tags,
            assetId: queued.input.assetId,
            expectedRowVersion: queued.expectedRowVersion,
            // Spec 12 § 14.1 — a queued offline save is a transport event,
            // not a declared save point. It does NOT write a body revision;
            // the revision is written when the author next does an explicit
            // Flush or a submit-for-review.
            source: 'autosave',
          },
        })
        await clearQueuedSave(lessonId)
        void queryClient.invalidateQueries({ queryKey: ['courses', 'lesson-edit', lessonId] })
        toast.success('Your offline changes were saved.')
      } catch {
        // A 409 will surface the conflict dialog; a network failure leaves
        // the queue entry intact so the next reconnect retries.
      }
    })()
  }, [onlineState.online, hydrated, lessonId, queryClient])

  // Surface mutation failures once, as a toast, whichever path triggered them.
  // Spec 12 § 8.2: a VERSION_CONFLICT opens the three-option conflict dialog
  // instead of a destructive Reload-only toast. The dialog offers Keep mine /
  // Take theirs / Compare, matching Part 04 S-2.7's Row Conflict state.
  useEffect(() => {
    if (!save.isError) return
    const message = save.error instanceof Error ? save.error.message : 'Save failed'
    if (message.includes('LOCKED_IN_REVIEW')) {
      toast.error('A reviewer is looking at this lesson — editing is locked.')
      return
    }
    if (message.includes('VERSION_CONFLICT')) {
      // Fetch the server's current rowVersion + body so the diff can render.
      // The dialog stays closed until we have both; the author sees a brief
      // "Resolving conflict…" toast in the meantime.
      toast.info('This lesson was updated elsewhere — opening the conflict dialog…')
      void (async () => {
        const { getLessonServerRowVersion } = await import('../server/all')
        const server = await getLessonServerRowVersion({ data: { lessonPublicId: lessonId } })
        setConflict({
          localRowVersion: rowVersion,
          serverRowVersion: server.rowVersion,
          serverBody: server.body ?? '',
        })
      })()
      return
    }
    if (message.includes('MARKDOWN_WRITES_DISABLED')) {
      toast.error('Markdown authoring is not enabled for this workspace yet.')
      return
    }
    toast.error(message.replace(/^[A-Z_]+:\s*/, ''))
  }, [save.isError, save.error, lessonId, rowVersion])

  // Spec 12 § 8.2 — resolve the conflict dialog. The three options:
  //  - Keep mine: re-stamp expectedRowVersion to the server value, write the
  //    audit-log override, retry the save once. A second 409 re-opens the
  //    dialog rather than looping.
  //  - Take theirs: discard the local buffer, hydrate the server body, clear
  //    the IndexedDB draft. This is the renamed Reload — destructive, so the
  //    dialog's UI confirms before reaching this branch.
  //  - Compare: opens the full-width overlay (handled inside the dialog). No
  //    resolution is recorded; the dialog stays open.
  async function handleConflictResolve(resolution: 'keep_mine' | 'take_theirs' | 'compare') {
    if (!conflict) return
    if (resolution === 'compare') return // handled in-dialog

    if (resolution === 'keep_mine') {
      const { recordLessonConflictOverride, saveLesson } = await import('../server/all')
      await recordLessonConflictOverride({
        data: {
          lessonPublicId: lessonId,
          localRowVersion: conflict.localRowVersion,
          serverRowVersion: conflict.serverRowVersion,
          resolution: 'keep_mine',
        },
      })
      setRowVersion(conflict.serverRowVersion)
      setConflict(null)
      // Single-shot retry. A second 409 re-opens the dialog via the effect
      // above rather than looping.
      try {
        await saveLesson({ data: buildInput() })
        toast.success('Your changes were saved.')
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : 'Save failed'
        if (msg.includes('VERSION_CONFLICT')) {
          toast.error('The lesson was updated again — reopen the conflict dialog.')
        } else {
          toast.error(msg.replace(/^[A-Z_]+:\s*/, ''))
        }
      }
      return
    }

    // take_theirs
    const { confirmServerBody } = await import('../server/all')
    const confirmed = await confirmServerBody({
      data: { lessonPublicId: lessonId, expectedRowVersion: conflict.serverRowVersion },
    })
    if (!confirmed.ok) {
      toast.error('The lesson moved again — reopen the conflict dialog.')
      setConflict({
        localRowVersion: conflict.localRowVersion,
        serverRowVersion: confirmed.rowVersion,
        serverBody: conflict.serverBody,
      })
      return
    }
    // Discard the local buffer and hydrate the server body. The IndexedDB
    // draft is cleared too — Take theirs is destructive, and leaving a
    // stale draft would re-trigger the restore prompt on next mount.
    await draftMirror.discardRestore()
    if (editor) {
      const serverBody = confirmed.body ?? ''
      editor.commands.setContent(serverBody, { contentType: 'markdown' })
      setMarkdown(normalizeMarkdown(editor.getMarkdown()))
    }
    setRowVersion(conflict.serverRowVersion)
    setDirty(false)
    setConflict(null)
    void queryClient.invalidateQueries({ queryKey: ['courses', 'lesson-edit', lessonId] })
    toast.success('Loaded the server version.')
  }

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
      {/* Spec 12 § 8.1.2 — offline banner. The editor is the documented
          exception to Part 11's "offline = read-only" rule: the canvas stays
          editable because the IndexedDB mirror keeps taking writes. The
          banner names the consequence and the queue depth. */}
      {!onlineState.online ? <OfflineBanner /> : null}

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
                contentType === 'video' && mediaSource === 'media' && assetId
                  ? 'Open the transcription & subtitle editor'
                  : 'Captions need a video from Media (library media source)'
              }
              disabled={locked || contentType !== 'video' || mediaSource !== 'media' || !assetId}
              onClick={() => {
                if (!assetId) return
                void navigate({
                  to: '/media/$assetId/transcript',
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
                  variant={mediaSource === 'media' ? 'default' : 'outline'}
                  size="xs"
                  role="tab"
                  aria-selected={mediaSource === 'media'}
                  disabled={locked}
                  onClick={() => {
                    setMediaSource('media')
                    setDirty(true)
                  }}
                >
                  Media
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
              {mediaSource === 'media' ? (
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
                    {assetId ? 'Change media asset' : 'Choose from Media'}
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

      <MediaAssetPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        categories={pickerCategories}
        onSelect={(asset) => {
          setAssetId(asset.publicId)
          setAssetName(asset.name)
          setMediaSource('media')
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

      {/* Spec 12 § 8.1.1 — IndexedDB restore prompt. Surfaced before the
          editor hydrates from the server body when a local draft exists at
          the current rowVersion. The prompt is never silent and never
          auto-applied. */}
      <ConfirmDialog
        open={draftMirror.restore.kind === 'pending'}
        onOpenChange={(open) => {
          if (!open) void handleRestoreDiscard()
        }}
        title="Restore unsaved draft?"
        body={
          draftMirror.restore.kind === 'pending'
            ? `You have unsaved changes to this lesson from ${new Date(
                draftMirror.restore.draft.updatedAt,
              ).toLocaleString()}. Restore them?`
            : ''
        }
        confirmLabel="Restore draft"
        cancelLabel="Discard"
        destructive={false}
        onConfirm={() => {
          handleRestoreAccept()
        }}
      />

      {/* Spec 12 § 8.2 — three-option conflict dialog. Opens on a 409 from
          saveLesson. Keep mine is the default (re-stamp + retry + audit log);
          Take theirs is the renamed Reload (destructive, last option);
          Compare opens a full-width overlay of the same diff. */}
      {conflict ? (
        <MarkdownConflictDialog
          open
          mine={sourceDraft ?? markdown}
          theirs={conflict.serverBody}
          onResolve={(resolution) => void handleConflictResolve(resolution)}
          onOpenChange={(open) => {
            if (!open) setConflict(null)
          }}
        />
      ) : null}
    </div>
  )
}

function SaveIndicator({
  status,
  savedAt,
}: {
  status: 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'offline' | 'suspended'
  savedAt: Date | null
}) {
  // Spec 12 § 8.1.2 — the autosave matrix's indicator column. Each cell has
  // a defined status string. `offline` and `suspended` use `aria-live=
  // "assertive"` per Part 11 / S-7.8 (error / conflict / offline are
  // assertive; idle / dirty / saving / saved are polite).
  const isAssertive = status === 'error' || status === 'offline' || status === 'suspended'
  const text =
    status === 'saving'
      ? 'Saving…'
      : status === 'error'
        ? 'Save failed — Retry'
        : status === 'dirty'
          ? 'Unsaved changes'
          : status === 'offline'
            ? 'Offline — changes queued'
            : status === 'suspended'
              ? 'Autosave paused (in review)'
              : status === 'saved' && savedAt
                ? `All changes saved at ${savedAt.toLocaleTimeString()}`
                : 'All changes saved'
  return (
    <p
      className="text-xs text-muted-foreground"
      aria-live={isAssertive ? 'assertive' : 'polite'}
      role="status"
      data-testid="lesson-save-indicator"
    >
      {text}
    </p>
  )
}
