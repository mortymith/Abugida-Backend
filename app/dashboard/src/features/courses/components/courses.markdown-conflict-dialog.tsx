/**
 * Three-option conflict dialog for the Lesson Editor — spec 12 § 8.2.
 *
 * Revision 3 of spec 12 closes the destructive-only alternative. Offering only
 * Reload destroys up to 60s of unsaved typing and contradicts DESIGN.md § 12;
 * "Reload" is a destructive action wearing a neutral label.
 *
 * The dialog offers three options, matching the Row Conflict state in Part 04
 * S-2.7 exactly:
 *
 *  - **Keep mine** (default): re-fetch the server row, re-stamp
 *    `expectedRowVersion`, retry the save once, and log the override to the
 *    audit log. A second 409 re-opens the dialog rather than looping.
 *  - **Take theirs**: discard the local buffer, hydrate the server body, clear
 *    the IndexedDB draft (§ 8.1.1). This is the renamed Reload — destructive,
 *    so it is the last option and requires confirmation.
 *  - **Compare**: opens the two bodies side by side in a full-width overlay.
 *    The same content as the default diff, at a size where a 5,000-word change
 *    is actually reviewable.
 *
 * The diff is read-only: no merge, no edit, no save. This is what makes the
 * other two options safe — the author can see exactly what they are choosing
 * between before they choose.
 */
import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import {
  diffMarkdown,
  summarizeDiff
  
} from '../courses.markdown-conflict'
import type {ConflictResolution} from '../courses.markdown-conflict';

export interface MarkdownConflictDialogProps {
  open: boolean
  /** The author's local Markdown body. */
  mine: string
  /** The server's Markdown body. */
  theirs: string
  /** Called when the author picks one of the three options. */
  onResolve: (resolution: ConflictResolution) => void
  /** Closes the dialog without resolving (Esc / backdrop click). */
  onOpenChange: (open: boolean) => void
}

/**
 * The default view is the two-column diff. Compare is a full-width overlay
 * that shows the same diff at a larger size — both surfaces render the same
 * rows, so the author can compare against the previous preview.
 */
export function MarkdownConflictDialog({
  open,
  mine,
  theirs,
  onResolve,
  onOpenChange,
}: MarkdownConflictDialogProps) {
  const [compareMode, setCompareMode] = useState(false)

  const rows = useMemo(() => diffMarkdown(mine, theirs), [mine, theirs])
  const summary = useMemo(() => summarizeDiff(rows), [rows])

  const handleResolve = (resolution: ConflictResolution) => {
    setCompareMode(false)
    onResolve(resolution)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={compareMode ? 'max-w-7xl' : 'max-w-5xl'}
        aria-describedby="conflict-description"
      >
        <DialogHeader>
          <DialogTitle>This lesson was updated elsewhere</DialogTitle>
          <DialogDescription id="conflict-description">
            Your changes conflict with a newer version on the server. Choose how to resolve —
            nothing is saved until you decide.
          </DialogDescription>
        </DialogHeader>

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {summary.added} added · {summary.removed} removed · {summary.changed} changed ·{' '}
          {summary.unchanged} unchanged
        </p>

        <div
          className={
            compareMode
              ? 'grid max-h-[60vh] grid-cols-2 gap-3 overflow-auto text-sm'
              : 'grid max-h-[50vh] grid-cols-2 gap-3 overflow-auto text-sm'
          }
          role="region"
          aria-label="Markdown diff"
        >
          <div>
            <div className="sticky top-0 bg-card pb-1 text-xs font-semibold text-muted-foreground">
              Yours (local)
            </div>
            <pre className="whitespace-pre-wrap break-words font-mono text-xs">
              {rows.map((row, idx) => (
                <div
                  key={`l-${idx}`}
                  className={
                    row.status === 'removed' || row.status === 'changed'
                      ? 'rounded bg-red-100 px-1 dark:bg-red-950'
                      : 'px-1'
                  }
                >
                  {row.left || '\u00a0'}
                </div>
              ))}
            </pre>
          </div>
          <div>
            <div className="sticky top-0 bg-card pb-1 text-xs font-semibold text-muted-foreground">
              Theirs (server)
            </div>
            <pre className="whitespace-pre-wrap break-words font-mono text-xs">
              {rows.map((row, idx) => (
                <div
                  key={`r-${idx}`}
                  className={
                    row.status === 'added' || row.status === 'changed'
                      ? 'rounded bg-green-100 px-1 dark:bg-green-950'
                      : 'px-1'
                  }
                >
                  {row.right || '\u00a0'}
                </div>
              ))}
            </pre>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap justify-between gap-2">
          <Button variant="outline" onClick={() => setCompareMode((prev) => !prev)}>
            {compareMode ? 'Compact view' : 'Compare full-width'}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              onClick={() => handleResolve('take_theirs')}
              aria-describedby="take-theirs-help"
            >
              Take theirs
            </Button>
            <span id="take-theirs-help" className="sr-only">
              Discards your local changes and loads the server version. This cannot be undone.
            </span>
            <Button variant="default" onClick={() => handleResolve('keep_mine')}>
              Keep mine
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
