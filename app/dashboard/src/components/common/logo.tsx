import { cn } from '#/lib/utils'

/** Fallback title for surfaces with no workspace (sign-in, sign-up). */
const DEFAULT_NAME = 'Abugida Academy'

/**
 * Wordmark. `name` lets the authenticated shell title the navigation with the
 * active organization instead of the platform name; outside a workspace (auth
 * screens) it stays the platform name.
 */
function Logo({ className, name }: { className?: string; name?: string | undefined }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-base font-extrabold text-primary-foreground shadow-sm">
        {(name ?? DEFAULT_NAME).trim().charAt(0).toUpperCase() || DEFAULT_NAME.charAt(0)}
      </div>
      <span className="truncate font-heading text-xl font-bold tracking-tight">
        {name ?? DEFAULT_NAME}
      </span>
    </div>
  )
}

export { Logo }
