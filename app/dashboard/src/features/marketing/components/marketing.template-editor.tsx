import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft01Icon, SaveIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { EyeIcon, Trash2Icon } from 'lucide-react'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { toast } from '#/components/common/toast'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'
import { Textarea } from '#/components/ui/textarea'
import { useRole } from '#/features/auth'
import { templateDetailQueryOptions } from '../hooks/marketing.queries'
import { useSaveTemplate, useSendTestTemplate } from '../hooks/marketing.mutations'
import { renderTemplateDocument } from '../marketing.email-render'
import { MERGE_TAGS, validateMergeTags } from '../marketing.merge-tags'
import type { MergeTagData } from '../marketing.merge-tags'
import type { TemplateBlockInput, TemplateSaveInput } from '../schemas/marketing.schema'

/**
 * S-8.2 Email Template Editor: subject/preheader, ordered blocks (hero,
 * text, button, course card) with the locked unsubscribe footer, merge-tag
 * picker with invalid-tag highlighting, live preview with sample data, test
 * send, and versioned publishes (campaigns pin the version they use).
 */
export function TemplateEditorView({ templateId }: { templateId: string }) {
  const role = useRole()
  const canWrite = role === 'admin' || role === 'editor'
  const isNew = templateId === 'new'

  const detailQuery = useQuery(templateDetailQueryOptions(isNew ? '__none__' : templateId))
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [kind, setKind] = useState<TemplateSaveInput['kind']>('custom')
  const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState('')
  const [blocks, setBlocks] = useState<TemplateBlockInput[]>([])
  const [loaded, setLoaded] = useState(false)
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)

  const saveTemplate = useSaveTemplate()
  const sendTest = useSendTestTemplate()

  useEffect(() => {
    const detail = detailQuery.data
    if (!detail || loaded) return
    setName(detail.name)
    setKind(detail.kind)
    setSubject(detail.subject ?? '')
    setPreheader(detail.preheader ?? '')
    setBlocks(
      (detail.document?.blocks ?? []).map((block) => ({
        ...block,
        subheading: block.subheading ?? undefined,
      })) as TemplateBlockInput[],
    )
    setLoaded(true)
  }, [detailQuery.data, loaded])

  const sampleData: MergeTagData = useMemo(
    () => ({
      first_name: 'Alemayehu',
      last_name: 'K.',
      email: 'alemayehu@example.com',
      course_name: 'TOEFL Complete',
      start_date: 'March 2',
      progress_url: 'https://abugida.app/dashboard',
      unsubscribe_url: 'https://abugida.app/unsubscribe',
    }),
    [],
  )

  const tagIssues = useMemo(
    () => validateMergeTags([subject, preheader, ...blocks.flatMap((block) => tagsOfBlock(block))]),
    [subject, preheader, blocks],
  )

  const preview = useMemo(
    () =>
      renderTemplateDocument(
        {
          blocks: blocks.map((block) => ({ ...block })),
        },
        sampleData,
      ),
    [blocks, sampleData],
  )

  const currentInput = () => ({
    templatePublicId: isNew ? undefined : templateId,
    name: name.trim() || 'Untitled template',
    kind,
    subject: subject.trim(),
    preheader: preheader.trim() || undefined,
    document: { blocks },
    publish: false,
  })

  const handleSave = async (publish: boolean) => {
    if (!name.trim()) {
      toast.warning('Give the template a name first.')
      return
    }
    if (!subject.trim()) {
      toast.warning('A subject is required.')
      return
    }
    if (publish && tagIssues.length > 0) {
      toast.error(
        `Unresolved merge tags: ${tagIssues.map((issue) => `{{${issue.tag}}}`).join(', ')}`,
      )
      return
    }
    const result = await saveTemplate.mutateAsync({ ...currentInput(), publish })
    if (publish) {
      toast.success(`Published as version ${result.version}.`)
      void navigate({ to: '/marketing/templates' })
    } else {
      toast.success('Draft saved.')
    }
  }

  if (!canWrite && !isNew && detailQuery.isError) {
    return <RetryErrorState onRetry={() => void detailQuery.refetch()} />
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void navigate({ to: '/marketing/templates' })}
            aria-label="Back to templates"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={18} aria-hidden />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{isNew ? 'New template' : name || 'Template'}</h1>
            <p className="text-sm text-muted-foreground">
              Blocks render top-to-bottom; the unsubscribe footer cannot be deleted.
            </p>
          </div>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void sendTest.mutateAsync({ templatePublicId: templateId }).catch(() => undefined)
              }
              disabled={isNew || sendTest.isPending}
            >
              <EyeIcon aria-hidden /> Send Test
            </Button>
            <Button onClick={() => void handleSave(false)} disabled={saveTemplate.isPending}>
              <HugeiconsIcon icon={SaveIcon} size={16} aria-hidden /> Save Draft
            </Button>
            <Button onClick={() => setPublishConfirmOpen(true)} disabled={saveTemplate.isPending}>
              Save Template
            </Button>
          </div>
        ) : null}
      </div>

      {detailQuery.isLoading && !isNew ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : detailQuery.isError && !isNew ? (
        <RetryErrorState onRetry={() => void detailQuery.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section aria-label="Editor" className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="template-name">Template name</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Course Announcement"
                maxLength={200}
                disabled={!canWrite}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
              <div className="grid gap-2">
                <Label htmlFor="template-kind">Kind</Label>
                <select
                  id="template-kind"
                  aria-label="Template kind"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  value={kind}
                  onChange={(event) => setKind(event.target.value as TemplateSaveInput['kind'])}
                  disabled={!canWrite}
                >
                  {[
                    'welcome',
                    'announcement',
                    'reminder',
                    'promotion',
                    'certificate_issued',
                    're_engagement',
                    'custom',
                  ].map((value) => (
                    <option key={value} value={value} className="capitalize">
                      {value.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="template-subject">Subject</Label>
                <Input
                  id="template-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={150}
                  disabled={!canWrite}
                  aria-describedby="template-subject-hint"
                />
                <p id="template-subject-hint" className="text-xs text-muted-foreground">
                  {150 - subject.length} characters left (max 150).
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="template-preheader">Preheader</Label>
              <Input
                id="template-preheader"
                value={preheader}
                onChange={(event) => setPreheader(event.target.value)}
                maxLength={300}
                disabled={!canWrite}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Blocks</Label>
                <BlockTypePicker
                  onAdd={(block) => setBlocks((current) => [...current, block])}
                  disabled={!canWrite}
                />
              </div>

              {blocks.map((block, index) => (
                <div key={index} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      {block.type.replace(/_/g, ' ')}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setBlocks((current) => {
                            if (index === 0) return current
                            const next = [...current]
                            const [moved] = next.splice(index, 1)
                            next.splice(index - 1, 0, moved)
                            return next
                          })
                        }
                        disabled={!canWrite || index === 0}
                        aria-label={`Move block ${index + 1} up`}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setBlocks((current) => {
                            if (index === current.length - 1) return current
                            const next = [...current]
                            const [moved] = next.splice(index, 1)
                            next.splice(index + 1, 0, moved)
                            return next
                          })
                        }
                        disabled={!canWrite || index === blocks.length - 1}
                        aria-label={`Move block ${index + 1} down`}
                      >
                        ↓
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setBlocks((current) => current.filter((_, i) => i !== index))
                        }
                        disabled={!canWrite}
                        aria-label={`Remove block ${index + 1}`}
                      >
                        <Trash2Icon className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                  <BlockFields
                    block={block}
                    onChange={(next) =>
                      setBlocks((current) => current.map((item, i) => (i === index ? next : item)))
                    }
                    disabled={!canWrite}
                  />
                </div>
              ))}

              <div
                className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground"
                aria-label="Locked footer block"
              >
                Footer with unsubscribe link (locked)
              </div>
            </div>

            <fieldset className="rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">Merge tags</legend>
              <p className="mb-2 text-xs text-muted-foreground">
                Insert tags into subject, preheader, or text. Unknown tags are highlighted before
                publish.
              </p>
              <div className="flex flex-wrap gap-1">
                {MERGE_TAGS.map((tag) => (
                  <code
                    key={tag}
                    className="rounded bg-muted px-1.5 py-0.5 text-xs"
                    title={`{{${tag}}}`}
                  >
                    {`{{${tag}}}`}
                  </code>
                ))}
              </div>
              {tagIssues.length > 0 ? (
                <ul className="mt-2 space-y-1" role="alert">
                  {tagIssues.map((issue) => (
                    <li key={issue.tag} className="text-xs text-destructive">
                      Unknown tag <code>{`{{${issue.tag}}}`}</code>
                      {issue.suggestions.length > 0
                        ? ` — did you mean ${issue.suggestions.map((suggestion) => `{{${suggestion}}}`).join(', ')}?`
                        : ''}
                    </li>
                  ))}
                </ul>
              ) : null}
            </fieldset>
          </section>

          <section aria-label="Live preview" className="rounded-lg border">
            <div className="border-b px-4 py-2 text-sm font-medium">Live preview (desktop)</div>
            <iframe
              title="Template preview"
              srcDoc={preview.html}
              className="h-[600px] w-full rounded-b-lg bg-white"
              sandbox=""
            />
          </section>
        </div>
      )}

      <ConfirmDialog
        open={publishConfirmOpen}
        onOpenChange={setPublishConfirmOpen}
        title="Publish a new version?"
        body="Campaigns and automations compose from the version they pin, so publishing never changes past campaigns. Future sends will use this version."
        confirmLabel="Publish version"
        destructive={false}
        onConfirm={async () => {
          await handleSave(true)
        }}
      />
    </div>
  )
}

function tagsOfBlock(block: TemplateBlockInput): string[] {
  switch (block.type) {
    case 'hero':
      return [block.heading, block.subheading ?? '']
    case 'text':
      return [block.body]
    case 'button':
      return [block.label, block.url]
    default:
      return []
  }
}

function BlockTypePicker({
  onAdd,
  disabled,
}: {
  onAdd: (block: TemplateBlockInput) => void
  disabled?: boolean
}) {
  return (
    <select
      aria-label="Add block"
      className="border-input bg-background flex h-9 w-40 rounded-md border px-3 text-sm"
      value=""
      disabled={disabled}
      onChange={(event) => {
        const value = event.target.value
        if (value === 'hero') onAdd({ type: 'hero', heading: 'A headline worth reading' })
        if (value === 'text') onAdd({ type: 'text', body: 'Hi {{first_name}}, …' })
        if (value === 'button')
          onAdd({ type: 'button', label: 'Open Abugida', url: '{{progress_url}}' })
        if (value === 'course_card') onAdd({ type: 'course_card', coursePublicId: null })
        event.target.value = ''
      }}
    >
      <option value="" disabled>
        Add block…
      </option>
      <option value="hero">Hero</option>
      <option value="text">Text</option>
      <option value="button">Button</option>
      <option value="course_card">Course card</option>
    </select>
  )
}

function BlockFields({
  block,
  onChange,
  disabled,
}: {
  block: TemplateBlockInput
  onChange: (next: TemplateBlockInput) => void
  disabled?: boolean
}) {
  if (block.type === 'hero') {
    return (
      <div className="grid gap-2">
        <Input
          value={block.heading}
          onChange={(event) => onChange({ ...block, heading: event.target.value })}
          placeholder="Heading"
          maxLength={200}
          disabled={disabled}
        />
        <Input
          value={block.subheading ?? ''}
          onChange={(event) => onChange({ ...block, subheading: event.target.value })}
          placeholder="Subheading (optional)"
          maxLength={300}
          disabled={disabled}
        />
      </div>
    )
  }
  if (block.type === 'text') {
    return (
      <Textarea
        value={block.body}
        onChange={(event) => onChange({ ...block, body: event.target.value })}
        rows={4}
        placeholder="Body text…"
        disabled={disabled}
      />
    )
  }
  if (block.type === 'button') {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={block.label}
          onChange={(event) => onChange({ ...block, label: event.target.value })}
          placeholder="Button label"
          maxLength={80}
          disabled={disabled}
        />
        <Input
          value={block.url}
          onChange={(event) => onChange({ ...block, url: event.target.value })}
          placeholder="https://… or {{progress_url}}"
          disabled={disabled}
        />
      </div>
    )
  }
  return (
    <p className="text-xs text-muted-foreground">
      Renders the featured course card at send time (course binding optional).
    </p>
  )
}
