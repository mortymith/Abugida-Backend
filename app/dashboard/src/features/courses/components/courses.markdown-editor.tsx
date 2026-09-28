import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { LESSON_EDITOR_EXTENSIONS } from '../courses.markdown-extensions'

/**
 * The one place a Tiptap `Editor` is constructed — spec 12 § 6.1.
 *
 * SSR safety (spec 12 § 3.4 / D-8): `immediatelyRender: false` is mandatory.
 * `new Editor({ content, contentType: 'markdown' })` throws
 * "there is no window object available" in a DOM-less runtime whenever the
 * Markdown parses to an empty document, and this app renders on the server with
 * Bun. Content is therefore never passed as the initial `content` option; the
 * caller hydrates after mount via `setContent(..., { contentType: 'markdown' })`.
 *
 * Tiptap is deliberately not re-exported from the feature barrel, so no route or
 * other feature can pull it into an SSR path by accident.
 */
export function MarkdownEditorSurface({
  editor,
  editable,
  className,
  label,
}: {
  editor: Editor | null
  editable: boolean
  className?: string
  label: string
}) {
  return (
    <div
      className={className}
      role="group"
      aria-label={label}
      aria-readonly={!editable}
      data-testid="lesson-editor-body"
    >
      <EditorContent editor={editor} />
    </div>
  )
}

/**
 * Build the lesson editor. Kept as a hook so the extension list is applied in
 * exactly one place, with `Markdown` last (D-6).
 */
export function useLessonEditor(options: { editable: boolean; onUpdate: () => void }) {
  return useEditor({
    extensions: LESSON_EDITOR_EXTENSIONS,
    immediatelyRender: false,
    editable: options.editable,
    onUpdate: options.onUpdate,
  })
}
