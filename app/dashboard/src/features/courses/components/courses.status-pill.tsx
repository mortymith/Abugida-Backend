import { cn } from '#/lib/utils'

/**
 * Status pill (spec 11): never color-only — color + label. Used for course
 * status and course type across S-2.1 / S-2.6.
 */
const TONES = {
  published: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  draft: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  archived: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  live: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  self_paced: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  instructor_led: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  hybrid: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  review: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  in_review: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  changes_requested: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
} as const

const LABELS: Record<string, string> = {
  published: 'Published',
  draft: 'Draft',
  archived: 'Archived',
  self_paced: 'Self Paced',
  instructor_led: 'Live',
  hybrid: 'Hybrid',
  review: 'In Review',
  in_review: 'In Review',
  pending: 'Pending',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  rejected: 'Rejected',
}

export function StatusPill({
  tone,
  label,
  className,
}: {
  tone: keyof typeof TONES
  label?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {label ?? LABELS[tone]}
    </span>
  )
}
