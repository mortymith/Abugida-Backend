import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  FileAddIcon,
  AiBookIcon,
  FolderAddIcon,
  ChevronDownIcon,
} from '@hugeicons/core-free-icons'

// Routes are not yet created — use string paths until route tree is extended
const COURSE_NEW = '/courses/new' as const
const COURSE_IMPORT = '/courses/import' as const

export function CreateCourseButton() {
  return (
    <div className="hidden items-center gap-0 md:flex">
      <Button nativeButton={false} size="sm" render={<a href={COURSE_NEW} />}>
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
        Create Course
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon-sm" className="rounded-l-none border-l-0" />}
        >
          <HugeiconsIcon icon={ChevronDownIcon} strokeWidth={2} />
          <span className="sr-only">More options</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<a href={COURSE_NEW} />}>
            <HugeiconsIcon icon={FileAddIcon} strokeWidth={2} />
            Blank Course
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href={`${COURSE_NEW}?template=true`} />}>
            <HugeiconsIcon icon={AiBookIcon} strokeWidth={2} />
            From Template
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href={`${COURSE_NEW}?ai=true`} />}>
            <HugeiconsIcon icon={AiBookIcon} strokeWidth={2} />
            With AI
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<a href={COURSE_IMPORT} />}>
            <HugeiconsIcon icon={FolderAddIcon} strokeWidth={2} />
            Bulk Import
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
