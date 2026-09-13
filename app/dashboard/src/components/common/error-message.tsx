import { HugeiconsIcon } from '@hugeicons/react'
import { AlertCircleIcon } from '@hugeicons/core-free-icons'

import { Alert, AlertDescription } from '#/components/ui/alert'
import { cn } from '#/lib/utils'

interface ErrorMessageProps {
  message: string
  className?: string
}

function ErrorMessage({ message, className }: ErrorMessageProps) {
  return (
    <Alert variant="destructive" className={cn('anim-up', className)}>
      <HugeiconsIcon icon={AlertCircleIcon} />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

export { ErrorMessage }
