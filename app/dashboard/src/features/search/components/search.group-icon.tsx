import { HugeiconsIcon } from '@hugeicons/react'
import { Book01Icon, FileEditIcon, Folder02Icon, StudentsIcon } from '@hugeicons/core-free-icons'
import { cn } from 'cn'
import type { SearchGroupType } from '../search.types'

const GROUP_ICONS = {
  course: Book01Icon,
  lesson: FileEditIcon,
  asset: Folder02Icon,
  student: StudentsIcon,
} satisfies Record<SearchGroupType, typeof Book01Icon>

/** Type icon shared by the palette and the results page, so both read alike. */
export function SearchGroupIcon({
  kind,
  className,
}: {
  kind: SearchGroupType
  className?: string
}) {
  const Icon = GROUP_ICONS[kind]
  return (
    <HugeiconsIcon
      icon={Icon}
      size={16}
      strokeWidth={1.5}
      aria-hidden="true"
      className={cn('shrink-0 text-muted-foreground', className)}
    />
  )
}
