import { Link, useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  AiBookIcon,
  ChevronDownIcon,
  FileAddIcon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { toast } from '#/components/common/toast'
import { canCreateCourse } from '../navigation.config'
import { trackNavEvent } from '../navigation.events'
import { useResumeDecision } from '../hooks/navigation.resume-target'
import { useWorkspaceRole } from '#/features/workspaces'

/**
 * Header quick-create: the **New Course** split button (S-A.1 · Primary
 * action 3).
 *
 * The whole control is **absent** for a role without `course.create` — Reviewer,
 * Viewer and Support get no disabled greyed-out button, because there is nothing
 * for them to do here (spec 11 case 1).
 *
 * The dropdown carries **Resume authoring** first when it is available: it is
 * the destination an author is most likely to want, and its conflict rules
 * (archived course, deleted course, lost `course.manage_curriculum`, an item
 * that has since been archived or moved) are resolved before it is rendered, so
 * it never lands on a dangling `item=` param.
 */
export function CreateCourseButton() {
  const role = useWorkspaceRole()
  const resume = useResumeDecision(role)
  const navigate = useNavigate()

  if (!canCreateCourse(role)) return null

  function handleResume() {
    if (resume.kind === 'hidden') return
    trackNavEvent('nav.resume_clicked', {
      course: resume.coursePublicId,
      fallback: resume.kind === 'fallback',
    })
    if (resume.kind === 'fallback') toast.info(resume.message)
    void navigate({ to: resume.to })
  }

  return (
    <div className="hidden items-center gap-0 md:flex">
      <Button size="sm" nativeButton={false} render={<Link to="/courses/new" />}>
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
        New Course
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon-sm"
              className="rounded-l-none border-l-0"
              aria-label="More ways to create a course"
            />
          }
        >
          <HugeiconsIcon icon={ChevronDownIcon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {resume.kind !== 'hidden' ? (
            <>
              <DropdownMenuItem onClick={handleResume}>
                <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
                <span className="min-w-0 flex-1 truncate">Continue in {resume.courseTitle}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}

          <DropdownMenuLabel>Start from</DropdownMenuLabel>
          <DropdownMenuItem nativeButton={false} render={<Link to="/courses/new" />}>
            <HugeiconsIcon icon={FileAddIcon} strokeWidth={2} />
            Blank course
          </DropdownMenuItem>
          <DropdownMenuItem nativeButton={false} render={<Link to="/courses/templates" />}>
            <HugeiconsIcon icon={AiBookIcon} strokeWidth={2} />
            From a template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
