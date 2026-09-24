import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight02Icon,
  BookEditIcon,
  CreditCardIcon,
  PaletteIcon,
  UserAdd01Icon,
} from '@hugeicons/core-free-icons'

import { Button } from '#/components/ui/button'

interface SignupStep3Props {
  onComplete: () => void
}

const CHECKLIST_ITEMS = [
  {
    icon: UserAdd01Icon,
    title: 'Invite your team',
    description: 'Add editors, reviewers, and viewers to your workspace.',
  },
  {
    icon: PaletteIcon,
    title: 'Brand your workspace',
    description: 'Add your logo and customize the look and feel.',
  },
  {
    icon: BookEditIcon,
    title: 'Create your first course',
    description: 'Start from blank, a template, or let AI draft it for you.',
  },
  {
    icon: CreditCardIcon,
    title: 'Connect a payment gateway',
    description: 'Set up payments to monetize your courses.',
  },
] as const

function SignupStep3({ onComplete }: SignupStep3Props) {
  return (
    <div className="flex flex-col gap-6 text-center">
      <ol className="flex flex-col gap-2.5 text-left">
        {CHECKLIST_ITEMS.map((item, index) => (
          <li
            key={item.title}
            className="anim-up flex items-start gap-3.5 rounded-xl border bg-muted/30 p-3.5 transition-colors hover:bg-muted/60"
            style={{ animationDelay: `${100 + index * 80}ms` }}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
            <HugeiconsIcon
              icon={ArrowRight02Icon}
              size={16}
              className="mt-2 shrink-0 text-muted-foreground/40"
            />
          </li>
        ))}
      </ol>

      <Button size="lg" className="w-full" onClick={onComplete}>
        Go to dashboard
        <HugeiconsIcon icon={ArrowRight02Icon} data-icon="inline-end" />
      </Button>
    </div>
  )
}

export { SignupStep3 }
