import { useEffect, useRef } from 'react'
import { Textarea } from '#/components/ui/textarea'
import { Label } from '#/components/ui/label'

/**
 * Raw Markdown pane — spec 12 § 7.1 ("split" and "source" views).
 *
 * A plain `<textarea>` rather than a CodeMirror instance. That is a deliberate
 * accessibility decision (spec 12 § 14, Q-1): a textarea is keyboard- and
 * screen-reader-operable with no extra work, whereas a rich editor surface
 * needs its own accessibility review to reach the same bar. Syntax highlighting
 * is the trade we are knowingly making.
 *
 * A plain textarea also keeps this component free of Tiptap, so it is safe to
 * render on the server.
 */
export function MarkdownSourcePane({
  value,
  onChange,
  readOnly,
  label = 'Lesson Markdown source',
  id = 'lesson-markdown-source',
  describedBy,
}: {
  value: string
  onChange: (value: string) => void
  readOnly: boolean
  label?: string
  id?: string
  describedBy?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Keep the caret where the author left it when the parent re-serializes.
  useEffect(() => {
    const node = ref.current
    if (!node || readOnly) return
    if (node.value === value) return
    const { selectionStart, selectionEnd } = node
    node.value = value
    const max = value.length
    node.setSelectionRange(Math.min(selectionStart, max), Math.min(selectionEnd, max))
  }, [value, readOnly])

  return (
    <div className="flex h-full flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        ref={ref}
        id={id}
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-describedby={describedBy}
        className="min-h-64 flex-1 resize-y font-mono text-sm leading-relaxed"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
