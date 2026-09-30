import { HugeiconsIcon } from '@hugeicons/react'
import { AlertCircleIcon } from '@hugeicons/core-free-icons'

import { Alert, AlertDescription } from '#/components/ui/alert'
import { cn } from '#/lib/utils'

interface ErrorMessageProps {
  message: string
  className?: string
  /**
   * Spec S-0.1/S-0.3 Keyboard & Focus: "On error, focus moves to the message
   * container (`role="alert"`, `tabindex="-1"`) so it is announced and
   * reachable." `Alert` already carries `role="alert"`; the `tabIndex` and this
   * ref are what let a screen actually move focus onto it.
   */
  ref?: React.Ref<HTMLDivElement>
  /** Renders the destructive tint. Off for the neutral "here's your state" copy. */
  destructive?: boolean
}

function ErrorMessage({ message, className, ref, destructive = true }: ErrorMessageProps) {
  if (!message) return null
  return (
    <Alert
      ref={ref}
      tabIndex={-1}
      variant={destructive ? 'destructive' : 'default'}
      className={cn('anim-up focus-visible:outline-none', className)}
    >
      <HugeiconsIcon icon={AlertCircleIcon} />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

export { ErrorMessage }
