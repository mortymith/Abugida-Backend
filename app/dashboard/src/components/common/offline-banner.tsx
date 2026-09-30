import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon } from '@hugeicons/core-free-icons'

import { cn } from '#/lib/utils'

/**
 * Spec 11 § Resilience States: Offline is a **persistent banner, not a toast**.
 * It names the consequence and, where the surface can say so, the reason a
 * control below is disabled.
 *
 * `role="status"` + `aria-live="polite"` so a screen-reader user learns about it
 * without having to go looking.
 */
export function OfflineBanner({
  message = "You're offline. Anything you can't finish now will be waiting when you reconnect.",
  className,
}: {
  message?: string
  className?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'mb-4 flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning-fg',
        className,
      )}
    >
      <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0" />
      <p className="text-pretty leading-relaxed">{message}</p>
    </div>
  )
}
