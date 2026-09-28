/**
 * Banner shown on a lesson whose body is still legacy HTML — spec 12 § 5.2.
 *
 * The lesson opens and saves exactly as it did before, so this is informational,
 * not a blocker. It exists so an author is not surprised when they switch to the
 * source view and find HTML rather than Markdown.
 */
export function LegacyBodyNotice({ lessonTitle }: { lessonTitle: string }) {
  return (
    <div
      className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100"
      role="status"
      data-testid="legacy-body-notice"
    >
      <p className="font-medium">This lesson body is still stored as HTML.</p>
      <p className="mt-1">
        It opens and saves normally. The Markdown conversion runs per lesson as part of the content
        migration; until then, “{lessonTitle}” will show HTML in the Markdown source view. Any edit
        you save converts it to Markdown.
      </p>
    </div>
  )
}
