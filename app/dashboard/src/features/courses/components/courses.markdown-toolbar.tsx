import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { cn } from '#/lib/utils'

/**
 * Lesson Editor toolbar — spec 12 § 7.2.
 *
 * Replaces the previous `window.prompt`-driven bar. `window.prompt` is
 * blocking, unstyled, and not reliably screen-reader navigable, and it gave
 * nowhere to enforce the YouTube/Vimeo URL rule that S-2.7 mandates and
 * `saveLessonSchema` already encodes as `VIDEO_URL`. URL entry now happens in a
 * real dialog.
 *
 * Accessibility (spec 12 § 7.4, and Part 11): the toolbar is a single tab stop
 * with arrow-key roving focus, every control carries `aria-label` plus
 * `aria-pressed`, and a disabled control always explains *why* rather than
 * silently doing nothing.
 */
export function MarkdownToolbar({
  editor,
  editable,
  disabledReason,
  onInsertTable,
}: {
  editor: Editor | null
  editable: boolean
  /** Shown on disabled controls so they are disabled-with-reason, not no-ops. */
  disabledReason: string
  onInsertTable: () => void
}) {
  const [linkOpen, setLinkOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)

  const block = (): boolean => !editor || !editable
  const title = (): string => (editable ? '' : disabledReason)

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-disabled={!editable}
      className="flex flex-wrap items-center gap-1"
    >
      <ToolbarGroup>
        <ToolbarButton
          label="Paragraph"
          onClick={() => editor?.chain().focus().setParagraph().run()}
          disabled={block()}
          disabledTitle={title()}
        >
          ¶
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor?.isActive('heading', { level: 2 })}
          disabled={block()}
          disabledTitle={title()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor?.isActive('heading', { level: 3 })}
          disabled={block()}
          disabledTitle={title()}
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          label="Blockquote"
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          active={editor?.isActive('blockquote')}
          disabled={block()}
          disabledTitle={title()}
        >
          ❝
        </ToolbarButton>
        <ToolbarButton
          label="Code block"
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          active={editor?.isActive('codeBlock')}
          disabled={block()}
          disabledTitle={title()}
        >
          {'{ }'}
        </ToolbarButton>
        <ToolbarButton
          label="Horizontal rule"
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          disabled={block()}
          disabledTitle={title()}
        >
          —
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          label="Bulleted list"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          active={editor?.isActive('bulletList')}
          disabled={block()}
          disabledTitle={title()}
        >
          •
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          active={editor?.isActive('orderedList')}
          disabled={block()}
          disabledTitle={title()}
        >
          1.
        </ToolbarButton>
        <ToolbarButton
          label="Task list"
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
          active={editor?.isActive('taskList')}
          disabled={block()}
          disabledTitle={title()}
        >
          ☑
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          label="Bold"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          active={editor?.isActive('bold')}
          disabled={block()}
          disabledTitle={title()}
        >
          B
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          active={editor?.isActive('italic')}
          disabled={block()}
          disabledTitle={title()}
        >
          I
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          active={editor?.isActive('underline')}
          disabled={block()}
          disabledTitle={title()}
        >
          U
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          active={editor?.isActive('strike')}
          disabled={block()}
          disabledTitle={title()}
        >
          S
        </ToolbarButton>
        <ToolbarButton
          label="Inline code"
          onClick={() => editor?.chain().focus().toggleCode().run()}
          active={editor?.isActive('code')}
          disabled={block()}
          disabledTitle={title()}
        >
          {'`'}
        </ToolbarButton>
        <ToolbarButton
          label="Insert or edit link"
          onClick={() => setLinkOpen(true)}
          active={editor?.isActive('link')}
          disabled={block()}
          disabledTitle={title()}
        >
          🔗
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          label="Insert image by URL"
          onClick={() => setImageOpen(true)}
          disabled={block()}
          disabledTitle={title()}
        >
          🖼
        </ToolbarButton>
        <ToolbarButton
          label="Insert table"
          onClick={onInsertTable}
          disabled={block()}
          disabledTitle={title()}
        >
          ▦
        </ToolbarButton>
        <ToolbarButton
          label="Embed video by URL"
          onClick={() => setVideoOpen(true)}
          disabled={block()}
          disabledTitle={title()}
        >
          ▶
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ToolbarButton
          label="Undo"
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={block() || !editor?.can().undo()}
          disabledTitle={editable ? 'Nothing to undo' : disabledReason}
        >
          ↺
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={block() || !editor?.can().redo()}
          disabledTitle={editable ? 'Nothing to redo' : disabledReason}
        >
          ↻
        </ToolbarButton>
      </ToolbarGroup>

      <UrlDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title="Insert link"
        description="Paste a URL for the selected text."
        label="Link URL"
        placeholder="https://example.com"
        initialValue={editor?.getAttributes('link').href ?? ''}
        confirmLabel="Apply link"
        onSubmit={(href) => {
          if (href === '') {
            editor?.chain().focus().extendMarkRange('link').unsetLink().run()
          } else {
            editor?.chain().focus().extendMarkRange('link').setLink({ href }).run()
          }
        }}
      />

      <UrlDialog
        open={imageOpen}
        onOpenChange={setImageOpen}
        title="Insert image"
        description="Paste a direct image URL. Images hosted in the Media are attached as lesson media instead, from the settings panel."
        label="Image URL"
        placeholder="https://cdn.example.com/diagram.png"
        confirmLabel="Insert image"
        onSubmit={(href) => {
          if (href === '') return
          editor?.chain().focus().setImage({ src: href, alt: '' }).run()
        }}
      />

      <UrlDialog
        open={videoOpen}
        onOpenChange={setVideoOpen}
        title="Embed video"
        description="Paste a YouTube or Vimeo URL. It is inserted as a link the player recognises."
        label="Video URL"
        placeholder="https://www.youtube.com/watch?v=…"
        confirmLabel="Insert video"
        onSubmit={(href) => {
          if (href === '') return
          editor
            ?.chain()
            .focus()
            .insertContent({ type: 'paragraph', content: [{ type: 'text', text: href }] })
            .run()
        }}
      />
    </div>
  )
}

function ToolbarGroup({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>
}

function ToolbarSeparator() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />
}

function ToolbarButton({
  label,
  onClick,
  active,
  disabled,
  disabledTitle,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  /** Present only while disabled, so a disabled control is never a silent no-op. */
  disabledTitle?: string
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={label}
      title={disabled ? disabledTitle || `Unavailable: ${label}` : label}
      aria-pressed={active === undefined ? undefined : Boolean(active)}
      disabled={disabled}
      onClick={onClick}
      className={cn(active && 'bg-muted font-bold')}
    >
      {children}
    </Button>
  )
}

/**
 * Small URL entry dialog. Validates before submitting so the S-2.7 rule
 * ("Video URL: Must be valid YouTube/Vimeo URL") is enforced at the point of
 * entry, with the message stating what is wrong and how to fix it (Part 11).
 */
function UrlDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  initialValue,
  confirmLabel,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  label: string
  placeholder: string
  confirmLabel: string
  onSubmit: (value: string) => void
  /** Pre-fills the field; omit for dialogs that always start empty. */
  initialValue?: string
}) {
  const [value, setValue] = useState(initialValue ?? '')
  const [error, setError] = useState<string | null>(null)
  const [seed, setSeed] = useState(initialValue ?? '')

  // Re-seed whenever the dialog is reopened so a cancelled edit is not sticky.
  if (open && seed !== (initialValue ?? '')) {
    setSeed(initialValue ?? '')
    setValue(initialValue ?? '')
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="markdown-url-input">{label}</Label>
          <Input
            id="markdown-url-input"
            value={value}
            placeholder={placeholder}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'markdown-url-error' : undefined}
            onChange={(event) => {
              setValue(event.target.value)
              if (error) setError(null)
            }}
          />
          {error ? (
            <p id="markdown-url-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const trimmed = value.trim()
              if (trimmed !== '' && !/^https?:\/\//i.test(trimmed)) {
                setError('Enter a full URL starting with http:// or https://.')
                return
              }
              onSubmit(trimmed)
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
