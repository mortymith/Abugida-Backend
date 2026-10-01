import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

/**
 * The one page header in the product (spec 11 · Hierarchy & Scannability).
 *
 * Thirty-odd screens were each hand-rolling their own title row, in three
 * different type recipes and four different action placements. The cost was not
 * ugliness, it was **inconsistency you could feel**: the eye learned a rhythm on
 * one screen and lost it on the next, and the heading level was whatever the
 * screen's author happened to reach for.
 *
 * This component owns the whole band:
 *
 * - **`<h1>` by default.** A module root has exactly one, so the heading outline
 *   is the same on every screen. A screen that is genuinely a sub-page (an edit
 *   form inside Settings) passes `level={2}` and keeps its place under the
 *   section title.
 * - **Eyebrow → title → description.** The order is fixed, so supporting copy
 *   always sits under the thing it describes.
 * - **Actions are right-aligned and wrap below** the title on narrow screens,
 *   rather than squeezing the title into an ellipsis on a phone.
 * - **`sticky` is opt-in.** The band is part of the scroll by default, which is
 *   what most screens want; a screen with a long list can pin it.
 */
interface PageHeaderProps {
  /** The screen's name. Rendered as the `<h1>` unless `level` says otherwise. */
  title: ReactNode
  /** Optional context line above the title — a module name or a record's state. */
  eyebrow?: ReactNode
  /** One sentence of supporting copy. Never a paragraph. */
  description?: ReactNode
  /** Primary action first, then secondary — the order is the visual order. */
  actions?: ReactNode
  /** `2` for a screen that lives inside another screen's section. */
  level?: 1 | 2
  /** Pin the band to the top of the scrolling content region. */
  sticky?: boolean
  /** Render flush to the region's edges instead of using the page gutter. */
  bleed?: boolean
  className?: string
  children?: ReactNode
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  level = 1,
  sticky = false,
  bleed = false,
  className,
  children,
}: PageHeaderProps) {
  const Heading = level === 1 ? 'h1' : 'h2'

  return (
    <div
      className={cn(
        'flex flex-col gap-4 pb-6 sm:flex-row sm:items-start sm:justify-between',
        // The gutter lives here, so a screen never has to remember `p-6`.
        !bleed && 'px-0 pt-0',
        sticky && 'sticky top-0 z-[5] -mx-6 bg-background/95 px-6 pt-6 backdrop-blur',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <Heading
          className={cn(
            'font-display font-bold tracking-tight text-pretty',
            level === 1 ? 'text-2xl' : 'text-xl',
          )}
        >
          {title}
        </Heading>
        {description ? (
          <p className="mt-1 max-w-2xl text-pretty text-sm text-muted-foreground">{description}</p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </div>
  )
}
