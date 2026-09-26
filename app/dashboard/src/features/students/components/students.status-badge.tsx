import { Badge } from '#/components/ui/badge'
import { cn } from '#/lib/utils'
import type { StudentAccountStatus } from '../students.types'

/**
 * Account status pill shared by the directory and the profile (S-4.1/S-4.2).
 */
const STATUS_META: Record<StudentAccountStatus, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  },
  pending_verification: {
    label: 'Invite pending',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  locked: {
    label: 'Locked',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  },
  suspended: {
    label: 'Suspended',
    className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  },
  deleted: { label: 'Deleted', className: 'bg-muted text-muted-foreground' },
}

export function StudentsStatusBadge({ status }: { status: StudentAccountStatus }) {
  const meta = STATUS_META[status]
  return (
    <Badge variant="secondary" className={cn('gap-1.5 font-medium', meta.className)}>
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          status === 'active'
            ? 'bg-emerald-600'
            : status === 'pending_verification'
              ? 'bg-amber-600'
              : 'bg-current',
        )}
      />
      {meta.label}
    </Badge>
  )
}
