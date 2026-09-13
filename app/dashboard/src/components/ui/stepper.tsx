import { HugeiconsIcon } from '@hugeicons/react'
import { Tick02Icon } from '@hugeicons/core-free-icons'

import { cn } from '#/lib/utils'

interface StepperProps {
  steps: string[]
  currentStep: number
  className?: string
}

function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <ol className={cn('flex items-center gap-2', className)}>
      {steps.map((step, index) => {
        const stepNumber = index + 1
        const isCompleted = stepNumber < currentStep
        const isCurrent = stepNumber === currentStep

        return (
          <li
            key={step}
            className="flex items-center gap-2"
            aria-current={isCurrent ? 'step' : undefined}
          >
            <div
              className={cn(
                'flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-500 [&_svg:not([class*="size-"])]:size-4',
                isCompleted && 'border-primary bg-primary text-primary-foreground',
                isCurrent && 'border-primary text-primary',
                !isCompleted && !isCurrent && 'border-muted-foreground/20 text-muted-foreground/50',
              )}
              style={
                isCurrent
                  ? { animation: 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }
                  : undefined
              }
            >
              {isCompleted ? <HugeiconsIcon icon={Tick02Icon} /> : stepNumber}
            </div>
            <span
              className={cn(
                'hidden text-xs font-semibold transition-colors duration-300 sm:inline',
                isCurrent
                  ? 'text-foreground'
                  : isCompleted
                    ? 'text-primary'
                    : 'text-muted-foreground/50',
              )}
            >
              {step}
            </span>
            {index < steps.length - 1 && (
              <div className="relative h-px w-8 sm:w-12" aria-hidden="true">
                <div className="absolute inset-0 bg-muted-foreground/10" />
                <div
                  className={cn(
                    'absolute inset-y-0 left-0 bg-primary transition-all duration-500',
                    isCompleted ? 'w-full' : 'w-0',
                  )}
                />
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export { Stepper }
