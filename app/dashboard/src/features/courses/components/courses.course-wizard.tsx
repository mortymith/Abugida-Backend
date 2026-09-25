import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { Label } from '#/components/ui/label'
import { Spinner } from '#/components/ui/spinner'
import { Stepper } from '#/components/ui/stepper'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { StatusPill } from './courses.status-pill'
import { CurriculumTree } from './courses.curriculum-tree'
import {
  courseDetailsQueryOptions,
  courseQueryKeys,
  courseReferenceQueryOptions,
  curriculumQueryOptions,
  coursePricingQueryOptions,
} from '../hooks/courses.queries'
import {
  accessLabelForModel,
  accessDaysForModel,
  BILLING_PERIOD_DAYS,
} from '../courses.pricing-logic'
import { canProceedFromCurriculum } from '../courses.curriculum-tree'
import type { BillingPeriod, CoursePublishInput } from '../schemas/courses.authoring.schema'

/**
 * S-2.2 → S-2.5 Course Creation Wizard. Four steps: Details, Curriculum,
 * Pricing, Publish. Also serves "Edit Details" (S-2.6) and duplicate flows
 * via `?from=<coursePublicId>`, in which case the wizard edits that draft.
 */
const STEPS = ['Details', 'Curriculum', 'Pricing', 'Publish'] as const

const detailsFormSchema = z.object({
  title: z.string().trim().min(3, 'At least 3 characters').max(100),
  description: z
    .string()
    .trim()
    .min(100, 'At least 100 characters')
    .max(500, 'At most 500 characters'),
  examTypeId: z.number('Pick a category').int().positive('Pick a category'),
  instructorId: z.string().trim().min(1, 'Pick an instructor'),
})

export function CourseWizard({ role }: { role: string }) {
  const navigate = useNavigate()
  const search = useSearch({ from: '/_app/courses/new' })
  const step = Math.min(Math.max(Number(search.step ?? 1), 1), 4) as 1 | 2 | 3 | 4
  const fromCourseId = search.from
  const canAuthor = role === 'admin' || role === 'editor'

  const reference = useQuery(courseReferenceQueryOptions())
  const source = useQuery({
    ...courseDetailsQueryOptions(fromCourseId ?? ''),
    enabled: Boolean(fromCourseId),
  })

  const [details, setDetails] = useState({
    title: '',
    description: '',
    examTypeId: 0,
    instructorId: '',
    courseType: 'self_paced' as 'self_paced' | 'instructor_led' | 'hybrid',
    level: null as 'beginner' | 'intermediate' | 'advanced' | null,
  })
  const [hydrated, setHydrated] = useState(false)
  const [detailsErrors, setDetailsErrors] = useState<Record<string, string>>({})
  const [confirmCancel, setConfirmCancel] = useState(false)

  useEffect(() => {
    if (hydrated || !source.data) return
    setDetails({
      title: source.data.title,
      description: source.data.description ?? '',
      examTypeId: source.data.examTypeId,
      instructorId: source.data.instructorId ?? '',
      courseType: source.data.courseType,
      level: source.data.level,
    })
    setHydrated(true)
  }, [hydrated, source.data])

  if (!canAuthor) {
    return (
      <EmptyState
        title="Authoring is limited to Admins and Editors"
        action={<Button render={<Link to="/courses" />}>Back to Courses</Button>}
      />
    )
  }
  if (reference.isPending || (fromCourseId && source.isPending)) {
    return <WizardSkeleton />
  }
  if (reference.isError) {
    return <RetryErrorState onRetry={() => void reference.refetch()} />
  }

  const examTypes = reference.data.examTypes

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Create New Course</h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of 4: {STEPS[step - 1]}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close wizard"
          onClick={() => setConfirmCancel(true)}
        >
          ✕
        </Button>
      </header>

      <Stepper steps={[...STEPS]} currentStep={step} />

      {step === 1 ? (
        <DetailsStep
          details={details}
          setDetails={setDetails}
          errors={detailsErrors}
          examTypes={examTypes}
        />
      ) : null}
      {step === 2 ? <CurriculumStep coursePublicId={fromCourseId} /> : null}
      {step === 3 ? <PricingStep coursePublicId={fromCourseId} /> : null}
      {step === 4 ? <PublishStep coursePublicId={fromCourseId} /> : null}

      <footer className="flex items-center justify-between border-t pt-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={step === 1}
            onClick={() =>
              void navigate({ to: '/courses/new', search: { ...search, step: step - 1 } })
            }
          >
            ← Back
          </Button>
          <Button variant="ghost" onClick={() => setConfirmCancel(true)}>
            Cancel
          </Button>
        </div>
        <NextControls
          step={step}
          fromCourseId={fromCourseId}
          details={details}
          setErrors={setDetailsErrors}
          examTypeIdFallback={examTypes[0]?.id ?? 0}
        />
      </footer>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Leave the course wizard?"
        body="You have unsaved changes in this wizard. Leaving now keeps whatever was already saved as draft."
        confirmLabel="Leave"
        destructive
        onConfirm={() => void navigate({ to: '/courses' })}
      />
    </div>
  )
}

function NextControls({
  step,
  fromCourseId,
  details,
  setErrors,
  examTypeIdFallback,
}: {
  step: number
  fromCourseId?: string
  details: { title: string; description: string; examTypeId: number; instructorId: string }
  setErrors: (errors: Record<string, string>) => void
  examTypeIdFallback: number
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const createDraft = useMutation({
    mutationFn: async () => {
      const examTypeId = details.examTypeId || examTypeIdFallback
      // "Save as Draft" applies partial validation (title only, per spec).
      if (fromCourseId) {
        await serverSaveDetails(fromCourseId, { ...details, examTypeId })
        return fromCourseId
      }
      const result = await serverCreateDraft({ title: details.title, examTypeId })
      return result.coursePublicId
    },
    onSuccess: (coursePublicId) => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success('Course saved as draft.')
      void navigate({ to: '/courses/new', search: { step: 2, from: coursePublicId } })
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Save failed'),
  })

  const saveAndNext = useMutation({
    mutationFn: async () => {
      const parsed = detailsFormSchema.safeParse({
        title: details.title,
        description: details.description,
        examTypeId: details.examTypeId || examTypeIdFallback,
        instructorId: details.instructorId,
      })
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {}
        for (const issue of parsed.error.issues) {
          fieldErrors[String(issue.path[0] ?? 'form')] = issue.message
        }
        setErrors(fieldErrors)
        throw new Error('Check the highlighted fields')
      }
      setErrors({})
      let coursePublicId = fromCourseId
      if (!coursePublicId) {
        const result = await serverCreateDraft({
          title: parsed.data.title,
          examTypeId: parsed.data.examTypeId,
        })
        coursePublicId = result.coursePublicId
      }
      await serverSaveDetails(coursePublicId, parsed.data)
      return coursePublicId
    },
    onSuccess: (coursePublicId) => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] })
      toast.success('Details saved.')
      void navigate({ to: '/courses/new', search: { step: 2, from: coursePublicId } })
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Save failed'),
  })

  if (step !== 1) return <WizardNext step={step} fromCourseId={fromCourseId} />

  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        disabled={createDraft.isPending || details.title.trim().length < 3}
        onClick={() => createDraft.mutate()}
      >
        {createDraft.isPending ? <Spinner className="size-4" /> : null}
        Save as Draft
      </Button>
      <Button disabled={saveAndNext.isPending} onClick={() => saveAndNext.mutate()}>
        {saveAndNext.isPending ? <Spinner className="size-4" /> : null}
        Next: Curriculum →
      </Button>
    </div>
  )
}

async function serverCreateDraft(input: { title: string; examTypeId: number }) {
  const { createCourseDraft } = await import('../server/all')
  return createCourseDraft({ data: input })
}

async function serverSaveDetails(
  coursePublicId: string,
  input: { title: string; description: string; examTypeId: number; instructorId: string },
) {
  const { saveCourseDetails } = await import('../server/all')
  return saveCourseDetails({ data: { ...input, coursePublicId } })
}

function WizardNext({ step, fromCourseId }: { step: number; fromCourseId?: string }) {
  const navigate = useNavigate()
  if (!fromCourseId) {
    return (
      <Button disabled onClick={() => undefined}>
        Next →
      </Button>
    )
  }
  return (
    <Button
      onClick={() =>
        void navigate({
          to: '/courses/new',
          search: { step: Math.min(step + 1, 4), from: fromCourseId },
        })
      }
    >
      Next →
    </Button>
  )
}

function DetailsStep({
  details,
  setDetails,
  errors,
  examTypes,
}: {
  details: {
    title: string
    description: string
    examTypeId: number
    instructorId: string
    courseType: 'self_paced' | 'instructor_led' | 'hybrid'
    level: 'beginner' | 'intermediate' | 'advanced' | null
  }
  setDetails: React.Dispatch<
    React.SetStateAction<{
      title: string
      description: string
      examTypeId: number
      instructorId: string
      courseType: 'self_paced' | 'instructor_led' | 'hybrid'
      level: 'beginner' | 'intermediate' | 'advanced' | null
    }>
  >
  errors: Record<string, string>
  examTypes: Array<{ id: number; name: string }>
}) {
  const reference = useQuery(courseReferenceQueryOptions())

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <div>
        <Label htmlFor="course-title">Course Title *</Label>
        <Input
          id="course-title"
          value={details.title}
          minLength={3}
          maxLength={100}
          onChange={(event) =>
            setDetails((previous) => ({ ...previous, title: event.target.value }))
          }
          aria-invalid={Boolean(errors.title)}
          required
        />
        {errors.title ? (
          <p className="text-destructive text-sm" role="alert">
            {errors.title}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="course-category">Category *</Label>
          <select
            id="course-category"
            value={details.examTypeId || ''}
            onChange={(event) =>
              setDetails((previous) => ({ ...previous, examTypeId: Number(event.target.value) }))
            }
            className="h-9 w-full rounded-lg border bg-input/30 px-3 text-sm"
          >
            <option value="" disabled>
              Select category
            </option>
            {examTypes.map((examType) => (
              <option key={examType.id} value={examType.id}>
                {examType.name}
              </option>
            ))}
          </select>
          {errors.examTypeId ? (
            <p className="text-destructive text-sm" role="alert">
              {errors.examTypeId}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="course-instructor">Instructor *</Label>
          <select
            id="course-instructor"
            value={details.instructorId}
            onChange={(event) =>
              setDetails((previous) => ({ ...previous, instructorId: event.target.value }))
            }
            className="h-9 w-full rounded-lg border bg-input/30 px-3 text-sm"
          >
            <option value="" disabled>
              Select instructor
            </option>
            {(reference.data?.instructors ?? []).map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.name}
              </option>
            ))}
          </select>
          {errors.instructorId ? (
            <p className="text-destructive text-sm" role="alert">
              {errors.instructorId}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <Label htmlFor="course-description">Description * (100–500 characters)</Label>
        <Textarea
          id="course-description"
          value={details.description}
          minLength={100}
          maxLength={500}
          rows={4}
          onChange={(event) =>
            setDetails((previous) => ({ ...previous, description: event.target.value }))
          }
          aria-invalid={Boolean(errors.description)}
          aria-describedby="description-count"
          required
        />
        <span id="description-count" className="text-xs tabular-nums text-muted-foreground">
          {details.description.length}/500
        </span>
        {errors.description ? (
          <p className="text-destructive text-sm" role="alert">
            {errors.description}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="text-sm font-medium">Course Type</legend>
          <div className="mt-2 flex flex-col gap-1">
            {(['self_paced', 'instructor_led', 'hybrid'] as const).map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="courseType"
                  checked={details.courseType === type}
                  onChange={() => setDetails((previous) => ({ ...previous, courseType: type }))}
                />
                {type === 'self_paced'
                  ? 'Self Paced'
                  : type === 'instructor_led'
                    ? 'Instructor-Led'
                    : 'Hybrid'}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium">Level</legend>
          <div className="mt-2 flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="courseLevel"
                checked={details.level == null}
                onChange={() => setDetails((previous) => ({ ...previous, level: null }))}
              />
              Not set
            </label>
            {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
              <label key={level} className="flex items-center gap-2 text-sm capitalize">
                <input
                  type="radio"
                  name="courseLevel"
                  checked={details.level === level}
                  onChange={() => setDetails((previous) => ({ ...previous, level }))}
                />
                {level}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  )
}

function CurriculumStep({ coursePublicId }: { coursePublicId?: string }) {
  const queryClient = useQueryClient()
  if (!coursePublicId) {
    return (
      <EmptyState
        title="Save your course details first"
        description="Go back to Step 1 and continue so the curriculum has a course to attach to."
      />
    )
  }
  return <CurriculumEditor coursePublicId={coursePublicId} queryClient={queryClient} />
}

/** Shared curriculum editor used by the wizard and the S-2.6 detail tab. */
export function CurriculumEditor({
  coursePublicId,
  queryClient,
  authoring = true,
  onOpenUnlockRules,
  onDuplicateLesson,
}: {
  coursePublicId: string
  queryClient: ReturnType<typeof useQueryClient>
  authoring?: boolean
  onOpenUnlockRules?: (lessonPublicId: string) => void
  onDuplicateLesson?: (lessonPublicId: string) => void
}) {
  const curriculum = useQuery(curriculumQueryOptions(coursePublicId))

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: courseQueryKeys.curriculum(coursePublicId) })

  const createModule = useMutation({
    mutationFn: async (title: string) => {
      const { createModule } = await import('../server/all')
      return createModule({ data: { coursePublicId, title } })
    },
    onSuccess: () => {
      invalidate()
      toast.success('Module added.')
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Failed'),
  })
  const createLesson = useMutation({
    mutationFn: async (input: { modulePublicId: string; title: string }) => {
      const { createLesson } = await import('../server/all')
      return createLesson({ data: input })
    },
    onSuccess: () => {
      invalidate()
      toast.success('Lesson added.')
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Failed'),
  })
  const renameModule = useMutation({
    mutationFn: async (input: { modulePublicId: string; title: string }) => {
      const { renameModule } = await import('../server/all')
      return renameModule({ data: input })
    },
    onSuccess: invalidate,
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Failed'),
  })
  const deleteModule = useMutation({
    mutationFn: async (modulePublicId: string) => {
      const { deleteModule } = await import('../server/all')
      return deleteModule({ data: { modulePublicId } })
    },
    onSuccess: () => {
      invalidate()
      toast.success('Module deleted.')
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Failed'),
  })
  const deleteLesson = useMutation({
    mutationFn: async (lessonPublicId: string) => {
      const { deleteLesson } = await import('../server/all')
      return deleteLesson({ data: { lessonPublicId } })
    },
    onSuccess: () => {
      invalidate()
      toast.success('Lesson deleted.')
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Failed'),
  })
  const reorder = useMutation({
    mutationFn: async (input: { moduleOrder: string[]; lessonOrder: Record<string, string[]> }) => {
      const { saveCurriculumOrder } = await import('../server/all')
      const current = await queryClient.fetchQuery(curriculumQueryOptions(coursePublicId))
      const modules = input.moduleOrder
        .map((publicId) => current.modules.find((module) => module.publicId === publicId))
        .filter((module) => module != null)
        .map((module) => ({
          publicId: module.publicId,
          title: module.title,
          lessons: (input.lessonOrder[module.publicId] ?? [])
            .map((lessonPublicId) =>
              module.lessons.find((lesson) => lesson.publicId === lessonPublicId),
            )
            .filter((lesson) => lesson != null)
            .map((lesson) => ({ publicId: lesson.publicId, title: lesson.title })),
        }))
      return saveCurriculumOrder({ data: { coursePublicId, modules } })
    },
    onSuccess: () => {
      invalidate()
      toast.success('Curriculum saved.')
    },
    onError: (cause) => {
      invalidate()
      toast.error(cause instanceof Error ? cause.message : 'Reorder failed')
    },
  })

  if (curriculum.isPending) return <WizardSkeleton />
  if (curriculum.isError) return <RetryErrorState onRetry={() => void curriculum.refetch()} />

  const proceed = canProceedFromCurriculum({
    modules: curriculum.data.modules.map((module) => ({
      publicId: module.publicId,
      title: module.title,
      lessons: module.lessons.map((lesson) => ({
        publicId: lesson.publicId,
        title: lesson.title,
        modulePublicId: module.publicId,
      })),
    })),
  })

  return (
    <section className="flex flex-col gap-3">
      <CurriculumTree
        curriculum={curriculum.data}
        coursePublicId={coursePublicId}
        authoring={authoring}
        busy={reorder.isPending}
        onCreateModule={(title) => createModule.mutate(title)}
        onCreateLesson={(modulePublicId, title) => createLesson.mutate({ modulePublicId, title })}
        onRenameModule={(modulePublicId, title) => renameModule.mutate({ modulePublicId, title })}
        onDeleteModule={(modulePublicId) => deleteModule.mutate(modulePublicId)}
        onDeleteLesson={(lessonPublicId) => deleteLesson.mutate(lessonPublicId)}
        onReorder={(moduleOrder, lessonOrder) => reorder.mutate({ moduleOrder, lessonOrder })}
        onOpenUnlockRules={onOpenUnlockRules}
        onDuplicateLesson={onDuplicateLesson}
      />
      {!proceed ? (
        <p className="text-sm text-muted-foreground">
          At least 1 module with 1 lesson is required before pricing and publish.
        </p>
      ) : null}
    </section>
  )
}

function PricingStep({ coursePublicId }: { coursePublicId?: string }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const pricing = useQuery({
    ...coursePricingQueryOptions(coursePublicId ?? ''),
    enabled: Boolean(coursePublicId),
  })
  const reference = useQuery(courseReferenceQueryOptions())

  const [model, setModel] = useState<'free' | 'one_time' | 'subscription'>('free')
  const [priceAmount, setPriceAmount] = useState('')
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')
  const [enrollmentEnd, setEnrollmentEnd] = useState('')
  const [earlyBirdPercent, setEarlyBirdPercent] = useState('')
  const [earlyBirdEndsAt, setEarlyBirdEndsAt] = useState('')
  const [bulkPercent, setBulkPercent] = useState('')
  const [bulkMin, setBulkMin] = useState('')
  const [gateways, setGateways] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (hydrated || !pricing.data) return
    setModel(pricing.data.model)
    setPriceAmount(pricing.data.priceAmount ?? '')
    setBillingPeriod(pricing.data.billingPeriod ?? 'monthly')
    setEnrollmentEnd(pricing.data.enrollmentEndAt?.slice(0, 10) ?? '')
    setEarlyBirdPercent(pricing.data.earlyBird?.percentage ?? '')
    setEarlyBirdEndsAt(pricing.data.earlyBird?.endsAt?.slice(0, 10) ?? '')
    setBulkPercent(pricing.data.bulk?.percentage ?? '')
    setBulkMin(pricing.data.bulk?.minEnrollments?.toString() ?? '')
    setGateways(
      pricing.data.gatewayOptions
        .filter((gateway) => gateway.configured)
        .map((gateway) => gateway.gatewayPublicId),
    )
    setHydrated(true)
  }, [hydrated, pricing.data])

  const save = useMutation({
    mutationFn: async () => {
      if (!coursePublicId) throw new Error('Save the course details first')
      const { saveCoursePricing } = await import('../server/all')
      return saveCoursePricing({
        data: {
          coursePublicId,
          model,
          priceAmount: model === 'free' ? null : Number(priceAmount) || null,
          priceCurrency: 'ETB',
          billingPeriod: model === 'subscription' ? billingPeriod : undefined,
          enrollmentStartAt: null,
          enrollmentEndAt: enrollmentEnd
            ? new Date(`${enrollmentEnd}T23:59:59Z`).toISOString()
            : null,
          earlyBird:
            earlyBirdPercent && Number(earlyBirdPercent) > 0
              ? {
                  percentage: Number(earlyBirdPercent),
                  endsAt: earlyBirdEndsAt
                    ? new Date(`${earlyBirdEndsAt}T23:59:59Z`).toISOString()
                    : null,
                  minEnrollments: null,
                }
              : null,
          bulk:
            bulkPercent && Number(bulkPercent) > 0
              ? {
                  percentage: Number(bulkPercent),
                  endsAt: null,
                  minEnrollments: Number(bulkMin) || null,
                }
              : null,
          gatewayPublicIds: gateways,
        },
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: courseQueryKeys.pricing(coursePublicId ?? ''),
      })
      toast.success('Pricing saved.')
      void navigate({ to: '/courses/new', search: { step: 4, from: coursePublicId } })
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : 'Save failed'),
  })

  if (!coursePublicId) {
    return (
      <EmptyState
        title="Save your course details first"
        description="Pricing attaches to a saved course."
      />
    )
  }
  if (pricing.isPending || reference.isPending) return <WizardSkeleton />
  if (pricing.isError) return <RetryErrorState onRetry={() => void pricing.refetch()} />

  const gatewaysList = pricing.data.gatewayOptions

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <fieldset>
        <legend className="text-sm font-medium">Pricing Model</legend>
        <div className="mt-2 flex gap-4">
          {(['free', 'one_time', 'subscription'] as const).map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="model"
                checked={model === option}
                onChange={() => setModel(option)}
              />
              {option === 'free'
                ? 'Free'
                : option === 'one_time'
                  ? 'One-Time Purchase'
                  : 'Subscription'}
            </label>
          ))}
        </div>
      </fieldset>

      {model !== 'free' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="price">Price (ETB) *</Label>
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={priceAmount}
              onChange={(event) => setPriceAmount(event.target.value)}
              aria-invalid={!Number(priceAmount) || Number(priceAmount) <= 0}
            />
          </div>
          {model === 'subscription' ? (
            <div>
              <Label htmlFor="billing">Billing Period *</Label>
              <select
                id="billing"
                value={billingPeriod}
                onChange={(event) => setBillingPeriod(event.target.value as BillingPeriod)}
                className="h-9 w-full rounded-lg border bg-input/30 px-3 text-sm"
              >
                <option value="monthly">Monthly ({BILLING_PERIOD_DAYS.monthly} days)</option>
                <option value="quarterly">Quarterly ({BILLING_PERIOD_DAYS.quarterly} days)</option>
                <option value="annual">Annual ({BILLING_PERIOD_DAYS.annual} days)</option>
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="enrollment-end">Enrollment Deadline</Label>
          <Input
            id="enrollment-end"
            type="date"
            value={enrollmentEnd}
            onChange={(event) => setEnrollmentEnd(event.target.value)}
          />
          <span className="text-xs text-muted-foreground">Leave empty for unlimited access.</span>
        </div>
      </div>

      <fieldset className="rounded-lg border p-3">
        <legend className="text-sm font-medium">Discount Options</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="early-bird">Early Bird %</Label>
            <Input
              id="early-bird"
              type="number"
              min="1"
              max="99"
              placeholder="10"
              value={earlyBirdPercent}
              onChange={(event) => setEarlyBirdPercent(event.target.value)}
            />
            <Input
              type="date"
              aria-label="Early bird deadline"
              value={earlyBirdEndsAt}
              onChange={(event) => setEarlyBirdEndsAt(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="bulk">Bulk Discount %</Label>
            <Input
              id="bulk"
              type="number"
              min="1"
              max="99"
              placeholder="15"
              value={bulkPercent}
              onChange={(event) => setBulkPercent(event.target.value)}
            />
            <Input
              type="number"
              min="1"
              placeholder="Minimum enrollments (e.g. 10)"
              aria-label="Bulk minimum enrollments"
              value={bulkMin}
              onChange={(event) => setBulkMin(event.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">
          Payment Gateways *{' '}
          <span className="font-normal text-muted-foreground">(at least one)</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {gatewaysList.map((gateway) => (
            <label
              key={gateway.gatewayPublicId}
              className={
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm' +
                (gateway.isEnabled ? '' : ' cursor-not-allowed opacity-50')
              }
            >
              <input
                type="checkbox"
                disabled={!gateway.isEnabled}
                checked={gateways.includes(gateway.gatewayPublicId)}
                onChange={(event) =>
                  setGateways((previous) =>
                    event.target.checked
                      ? [...previous, gateway.gatewayPublicId]
                      : previous.filter((id) => id !== gateway.gatewayPublicId),
                  )
                }
              />
              {gateway.displayName}
              {!gateway.isEnabled ? (
                <span className="text-xs text-muted-foreground">not configured</span>
              ) : null}
            </label>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        className="self-end"
        disabled={save.isPending || gateways.length === 0}
        onClick={() => save.mutate()}
      >
        {save.isPending ? <Spinner className="size-4" /> : null}
        Save Pricing
      </Button>
    </section>
  )
}

function PublishStep({ coursePublicId }: { coursePublicId?: string }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const detailsQuery = useQuery({
    ...courseDetailsQueryOptions(coursePublicId ?? ''),
    enabled: Boolean(coursePublicId),
  })
  const curriculum = useQuery({
    ...curriculumQueryOptions(coursePublicId ?? ''),
    enabled: Boolean(coursePublicId),
  })
  const pricing = useQuery({
    ...coursePricingQueryOptions(coursePublicId ?? ''),
    enabled: Boolean(coursePublicId),
  })

  const [visibility, setVisibility] = useState<'draft' | 'published'>('published')
  const [releaseMode, setReleaseMode] = useState<'immediate' | 'scheduled'>('immediate')
  const [scheduledFor, setScheduledFor] = useState('')
  const [notifyStudents, setNotifyStudents] = useState(true)
  const [notifySubscribers, setNotifySubscribers] = useState(true)
  const [confirmed, setConfirmed] = useState(false)

  const publish = useMutation({
    mutationFn: async (input: CoursePublishInput) => {
      const { publishCourse } = await import('../server/all')
      return publishCourse({ data: input })
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['courses'] })
      if (result.scheduled) {
        toast.success('Course scheduled for release.')
      } else {
        toast.success('Course published successfully!')
      }
      void navigate({ to: '/courses/$courseId', params: { courseId: result.coursePublicId } })
    },
    onError: (cause) => toast.error(cause instanceof Error ? cause.message : 'Publish failed'),
  })

  const moduleCount = curriculum.data?.modules.length ?? 0
  const lessonCount = useMemo(
    () => (curriculum.data?.modules ?? []).reduce((sum, module) => sum + module.lessons.length, 0),
    [curriculum.data],
  )

  if (!coursePublicId) {
    return (
      <EmptyState
        title="Save your course details first"
        description="Publishing needs a saved course."
      />
    )
  }
  if (detailsQuery.isPending || curriculum.isPending || pricing.isPending) return <WizardSkeleton />
  if (detailsQuery.isError) return <RetryErrorState onRetry={() => void detailsQuery.refetch()} />

  const course = detailsQuery.data

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border bg-card p-5 shadow-sm" aria-label="Review summary">
        <h2 className="mb-2 font-semibold">Review Summary</h2>
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            ✅ <strong>{course.title}</strong> — {course.examTypeName ?? 'Uncategorized'} ·{' '}
            {course.instructorName ?? 'No instructor'} · <StatusPill tone={course.courseType} />
          </li>
          <li>
            ✅ Curriculum: {moduleCount} modules, {lessonCount} lessons
          </li>
          <li>
            ✅ Pricing:{' '}
            {pricing.data
              ? accessLabelForModel(pricing.data.model, pricing.data.billingPeriod ?? undefined)
              : '—'}
            {pricing.data?.priceAmount
              ? ` (${pricing.data.priceCurrency} ${pricing.data.priceAmount}, ${accessDaysForModel(pricing.data.model, pricing.data.billingPeriod ?? undefined)} days)`
              : ''}
          </li>
        </ul>
      </section>

      <section
        className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm"
        aria-label="Publish settings"
      >
        <fieldset>
          <legend className="text-sm font-medium">Visibility</legend>
          <div className="mt-2 flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="visibility"
                checked={visibility === 'draft'}
                onChange={() => setVisibility('draft')}
              />
              Private (Draft)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="visibility"
                checked={visibility === 'published'}
                onChange={() => setVisibility('published')}
              />
              Published (Public)
            </label>
          </div>
        </fieldset>

        {visibility === 'published' ? (
          <>
            <fieldset>
              <legend className="text-sm font-medium">Release Date</legend>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="release"
                    checked={releaseMode === 'immediate'}
                    onChange={() => setReleaseMode('immediate')}
                  />
                  Immediately
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="release"
                    checked={releaseMode === 'scheduled'}
                    onChange={() => setReleaseMode('scheduled')}
                  />
                  Schedule
                </label>
                {releaseMode === 'scheduled' ? (
                  <Input
                    type="datetime-local"
                    className="w-56"
                    aria-label="Scheduled release time"
                    value={scheduledFor}
                    onChange={(event) => setScheduledFor(event.target.value)}
                  />
                ) : null}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium">Notifications</legend>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifyStudents}
                  onChange={(event) => setNotifyStudents(event.target.checked)}
                />
                Notify enrolled students when published
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifySubscribers}
                  onChange={(event) => setNotifySubscribers(event.target.checked)}
                />
                Send announcement to subscribers
              </label>
            </fieldset>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              I confirm all content is complete and ready for publication.
            </label>
          </>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            disabled={publish.isPending}
            onClick={() =>
              publish.mutate({
                coursePublicId: course.publicId,
                visibility: 'draft',
                releaseMode: 'immediate',
                scheduledFor: null,
                notifyStudents: false,
                notifySubscribers: false,
                confirmed: true,
              })
            }
          >
            Save as Draft
          </Button>
          <Button
            disabled={publish.isPending || visibility !== 'published' || !confirmed}
            onClick={() =>
              publish.mutate({
                coursePublicId: course.publicId,
                visibility,
                releaseMode,
                scheduledFor:
                  releaseMode === 'scheduled' && scheduledFor
                    ? new Date(scheduledFor).toISOString()
                    : null,
                notifyStudents,
                notifySubscribers,
                confirmed,
              })
            }
          >
            {publish.isPending ? <Spinner className="size-4" /> : null}
            Publish Course
          </Button>
        </div>
      </section>
    </div>
  )
}

function WizardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-24 animate-pulse rounded-xl bg-muted" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}
