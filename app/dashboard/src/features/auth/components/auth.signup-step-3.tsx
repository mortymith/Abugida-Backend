import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight02Icon,
  BookEditIcon,
  CreditCardIcon,
  PaletteIcon,
  UserAdd01Icon,
} from '@hugeicons/core-free-icons'

import { Button } from '#/components/ui/button'
import { checklistItemsFor } from '#/features/onboarding/onboarding.checklist'
import type { ChecklistItemId } from '#/features/onboarding/onboarding.checklist'

interface SignupStep3Props {
  onComplete: () => void
  /** The workspace's `PrimaryUseCase` — decides which tasks are listed. */
  useCase: string
}

const ICONS: Record<ChecklistItemId, typeof UserAdd01Icon> = {
  invite_team: UserAdd01Icon,
  brand_workspace: PaletteIcon,
  first_course: BookEditIcon,
  payment_gateway: CreditCardIcon,
}

/**
 * S-0.2 step 3 — what happens next.
 *
 * The list shown here is derived from `PrimaryUseCase` by the same pure module
 * that drives the dashboard card, so the two can never disagree. For a
 * workspace that will never charge, _Connect a payment gateway_ is **absent** —
 * not greyed out. Nothing is ticked yet: every item flips on a real server-side
 * criterion once the user does the work, not on a click.
 */
function SignupStep3({ onComplete, useCase }: SignupStep3Props) {
  const items = checklistItemsFor(useCase)

  return (
    <div className="flex flex-col gap-6 text-center">
      <ol className="flex flex-col gap-2.5 text-left">
        {items.map((item) => {
          const Icon = ICONS[item.id]
          return (
            <li
              key={item.id}
              className="flex items-start gap-3.5 rounded-xl border bg-muted/30 p-3.5"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HugeiconsIcon icon={Icon} size={18} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </li>
          )
        })}
      </ol>

      <Button size="lg" className="w-full" onClick={onComplete}>
        Go to dashboard
        <HugeiconsIcon icon={ArrowRight02Icon} data-icon="inline-end" />
      </Button>
    </div>
  )
}

export { SignupStep3 }
