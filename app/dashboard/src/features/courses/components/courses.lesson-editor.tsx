import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Spinner } from '#/components/ui/spinner'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { StatusPill } from './courses.status-pill'
import { courseQueryKeys } from '../hooks/courses.queries'
import { REVIEW_STATE_LABELS } from '../courses.review-state'
import { LibraryAssetPicker } from '#/features/library'
import type { SaveLessonInput } from '../server/courses.lessons'
import type { LessonEditDTO } from '../server/courses.lessons.impl.server'
import type { AssetCategory } from '@abugida/database/catalog'

/**
 * S-2.7 Lesson Editor: two-column layout — rich text content editor with
 * media embeds on the left, lesson settings (type, video URL, duration,
 * status, tags) on the right. In Review locks editing; Changes Requested
 * shows reviewer comments with re-submit; Approved shows ready-to-publish.
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

  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({ placeholder: 'Lesson content — rich text, media links…' }),
    ],
    immediatelyRender: false,
    editable: false,
    onUpdate: () => setDirty(true),
  })

  useEffect(() => {
    if (hydrated || !lesson.data || !editor) return
    setTitle(lesson.data.title)
    setContentType(lesson.data.contentType)
    setVideoUrl(lesson.data.videoUrl ?? '')
    setAssetId(lesson.data.assetId ?? null)
    setAssetName(lesson.data.assetName)
    setMediaSource(lesson.data.assetId ? 'library' : 'url')
    setDurationMinutes(lesson.data.durationMinutes?.toString() ?? '')
    setTagsDraft(lesson.data.tags.join(', '))
    setRowVersion(lesson.data.rowVersion)
    editor.commands.setContent(lesson.data.body ?? '')
    const locked = lesson.data.reviewStatus === 'in_review'
    editor.setEditable(!locked)
    setHydrated(true)
  }, [hydrated, lesson.data, editor])

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
      toast.success('Lesson saved successfully.')
    },
    onError: (cause) => {
      const message = cause instanceof Error ? cause.message : 'Save failed'
      if (message.includes('LOCKED_IN_REVIEW')) {
        toast.error('A reviewer is looking at this lesson — editing is locked.')
      } else {
        toast.error(message.replace(/^[A-Z_]+:\s*/, ''))
      }
    },
  })

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

  if (lesson.isPending) {
    return <Spinner className="mx-auto my-12" />
  }
  if (lesson.isError) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Unable to load this lesson.</p>
        <Button variant="link" onClick={() => void lesson.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  const data = lesson.data
  const locked = data.reviewStatus === 'in_review'
  const changesRequested = data.reviewStatus === 'changes_requested'
  const approved = data.reviewStatus === 'approved'
  const reviewGate = data.requiresApproval

  const buildInput = (): SaveLessonInput => ({
    lessonPublicId: lessonId,
    title: title.trim(),
    body: editor && editor.getText().length > 0 ? editor.getHTML() : '',
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
  })

  function openPicker(categories: AssetCategory[]) {
    setPickerCategories(categories)
    setPickerOpen(true)
  }

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

          <div className="mb-2 flex flex-wrap gap-1" role="toolbar" aria-label="Formatting">
            <ToolbarButton
              label="Bold"
              disabled={locked}
              onClick={() => editor?.chain().focus().toggleBold().run()}
              active={editor?.isActive('bold')}
            >
              B
            </ToolbarButton>
            <ToolbarButton
              label="Italic"
              disabled={locked}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              active={editor?.isActive('italic')}
            >
              I
            </ToolbarButton>
            <ToolbarButton
              label="Heading"
              disabled={locked}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor?.isActive('heading')}
            >
              H2
            </ToolbarButton>
            <ToolbarButton
              label="Bullet list"
              disabled={locked}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              active={editor?.isActive('bulletList')}
            >
              •
            </ToolbarButton>
            <ToolbarButton
              label="Numbered list"
              disabled={locked}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              active={editor?.isActive('orderedList')}
            >
              1.
            </ToolbarButton>
            <ToolbarButton
              label="Insert link"
              disabled={locked}
              onClick={() => {
                const url = window.prompt('Link URL')
                if (url) editor?.chain().focus().setLink({ href: url }).run()
              }}
            >
              🔗
            </ToolbarButton>
            <ToolbarButton
              label="Embed video by URL"
              disabled={locked}
              onClick={() => {
                const url = window.prompt('YouTube or Vimeo URL')
                if (url)
                  editor?.chain().focus().insertContent(`<p><a href="${url}">${url}</a></p>`).run()
              }}
            >
              ▶
            </ToolbarButton>
            <ToolbarButton
              label="Link a PDF"
              disabled={locked}
              onClick={() => {
                const url = window.prompt('PDF URL')
                if (url)
                  editor
                    ?.chain()
                    .focus()
                    .insertContent(`<p><a href="${url}">📄 PDF resource</a></p>`)
                    .run()
              }}
            >
              📄
            </ToolbarButton>
          </div>

          <div className="min-h-64 rounded-lg border p-3 text-sm" data-testid="lesson-editor-body">
            <EditorContent editor={editor} />
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
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
              disabled={locked || save.isPending || title.trim().length < 3}
              onClick={() => save.mutate(buildInput())}
            >
              {save.isPending ? <Spinner className="size-4" /> : null}
              Save
            </Button>
          </div>
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

function ToolbarButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-xs"
      aria-label={label}
      title={label}
      aria-pressed={Boolean(active)}
      onClick={onClick}
      disabled={disabled}
      className={active ? 'bg-muted font-bold' : ''}
    >
      {children}
    </Button>
  )
}
