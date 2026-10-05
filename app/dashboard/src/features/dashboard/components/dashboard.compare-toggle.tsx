import { HugeiconsIcon } from '@hugeicons/react'
import { Tick01Icon } from '@hugeicons/core-free-icons'
import { cn } from 'cn'

interface CompareToggleProps {
  /** Whether the screen compares against the previous period. */
  enabled: boolean
  onToggle: (next: boolean) => void
  className?: string
}

/**
 * "Compare vs previous period" toggle (S-1.1 / S-1.2).
 *
 * A checkbox in the spec's wireframe, and one in behaviour: `aria-pressed`
 * carries the state, the icon carries the affordance, and the label says what
 * is being compared. Turning it off makes every delta read `—` rather than
 * pretending there is a comparison to show.
 */
export function CompareToggle({ enabled, onToggle, className }: CompareToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={() => onToggle(!enabled)}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium transition-colors',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        enabled ? 'bg-accent text-accent-foreground' : 'bg-background hover:bg-muted',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-4 items-center justify-center rounded-[4px] border',
          enabled
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/50',
        )}
      >
        {enabled ? <HugeiconsIcon icon={Tick01Icon} size={12} strokeWidth={2} /> : null}
      </span>
      Compare vs previous period
    </button>
  )
}
