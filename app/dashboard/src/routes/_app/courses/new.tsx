import { createFileRoute } from '@tanstack/react-router'
import { useRole } from '#/features/auth'
import { CourseWizard } from '#/features/courses'

type NewCourseSearch = {
  step?: number
  from?: string
}

export const Route = createFileRoute('/_app/courses/new')({
  // (declared before use below — TS hoists the type)
  validateSearch: (search: Record<string, unknown>): NewCourseSearch => ({
    step:
      typeof search.step === 'number'
        ? search.step
        : typeof search.step === 'string'
          ? Number(search.step)
          : undefined,
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  component: NewCourseRoute,
})

function NewCourseRoute() {
  const role = useRole()
  return <CourseWizard role={role} />
}
