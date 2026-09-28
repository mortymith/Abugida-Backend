import { Streamdown } from 'streamdown'
import { LESSON_EDITOR_PLACEHOLDER } from '../courses.markdown-extensions'

/**
 * Rendered lesson preview — spec 12 § 7.1 ("preview" view).
 *
 * Purpose: show the author exactly what a student will see, which is also what
 * the S-2.14 reviewer approves. It is the cheapest defence against a lesson that
 * looks right in the editor and wrong in the reader.
 *
 * Uses `streamdown`, already a dashboard dependency, rather than adding a second
 * Markdown renderer. `mode="static"` is required: the default streaming mode
 * exists to animate LLM output and adds work this surface does not need.
 *
 * `controls={false}` removes the code-block copy/download chrome, which is
 * authoring furniture and not part of the lesson.
 *
 * On safety: `streamdown` sanitizes by default — `allowedTags` starts empty, so
 * raw HTML in a lesson body is not rendered as markup, and `rehype-raw` is
 * never supplied. A lesson body therefore cannot inject script into the
 * dashboard. The editor additionally escapes `&` and `<` on serialize, so
 * author-intended raw HTML is inert at the source as well.
 */
export function MarkdownPreview({ markdown }: { markdown: string }) {
  if (markdown.trim() === '') {
    return (
      <p
        className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"
        data-testid="lesson-preview-empty"
      >
        {LESSON_EDITOR_PLACEHOLDER}
      </p>
    )
  }

  return (
    <div
      className="max-w-[75ch] text-sm leading-relaxed"
      data-testid="lesson-preview"
      // A preview is a static region; announcing it on every autosave would be
      // noise for screen-reader users.
      aria-live="off"
    >
      <Streamdown mode="static" controls={false} parseIncompleteMarkdown={false}>
        {markdown}
      </Streamdown>
    </div>
  )
}
