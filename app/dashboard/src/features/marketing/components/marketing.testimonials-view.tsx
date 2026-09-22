import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { MessageSquareQuoteIcon, StarIcon } from 'lucide-react'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { toast } from '#/components/common/toast'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'
import { Textarea } from '#/components/ui/textarea'
import { useRole } from '#/features/auth'
import {
  testimonialCourseOptionsQueryOptions,
  testimonialSettingsQueryOptions,
  testimonialsQueryOptions,
} from '../hooks/marketing.queries'
import {
  useCollectTestimonialManually,
  useDecideTestimonial,
  useSaveTestimonialSettings,
  useSetTestimonialFeatured,
} from '../hooks/marketing.mutations'
import { QUOTE_MAX_LENGTH, QUOTE_MIN_LENGTH } from '../marketing.testimonial-rules'
import type { TestimonialQueryInput } from '../schemas/marketing.schema'
import type { TestimonialRow } from '../marketing.types'

/**
 * S-8.5 Student Testimonials: consent-first moderation queue (approve,
 * light-edit with editor initials, reject), published list with course
 * filter and featured marks, landing-page display format, and the automated
 * collection triggers. Approve stays disabled until consent is verified.
 */
export function TestimonialsView({
  query,
  onQueryChange,
}: {
  query: TestimonialQueryInput
  onQueryChange: (query: TestimonialQueryInput) => void
}) {
  const role = useRole()
  const canModerate = role === 'admin' || role === 'editor' || role === 'support'

  const testimonialsQuery = useQuery(testimonialsQueryOptions(query))
  const settingsQuery = useQuery(testimonialSettingsQueryOptions())
  const [collectOpen, setCollectOpen] = useState(false)

  const items = testimonialsQuery.data?.items ?? []
  const isQueue = query.status === 'pending'

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Student Testimonials</h1>
          <p className="text-sm text-muted-foreground">
            Collect, moderate, and display student testimonials on course landing pages.
          </p>
        </div>
        {canModerate && <Button onClick={() => setCollectOpen(true)}>Collect Manually</Button>}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="Status filter"
          className="border-input bg-background flex h-9 w-44 rounded-md border px-3 text-sm"
          value={query.status}
          onChange={(event) => onQueryChange({ ...query, status: event.target.value as 'pending' })}
        >
          <option value="pending">Moderation queue</option>
          <option value="published">Published</option>
        </select>
        <CourseFilter
          course={query.course}
          onCourseChange={(course) => onQueryChange({ ...query, course })}
        />
      </div>

      {settingsQuery.data && isQueue ? <TriggerSettingsCard /> : null}

      {testimonialsQuery.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : testimonialsQuery.isError ? (
        <RetryErrorState onRetry={() => void testimonialsQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<MessageSquareQuoteIcon className="size-10 text-muted-foreground" aria-hidden />}
          title={isQueue ? 'The moderation queue is empty' : 'No published testimonials yet'}
          description={
            isQueue
              ? 'New submissions appear here sorted by rating and course.'
              : 'Approve submissions from the moderation queue to publish them.'
          }
        />
      ) : isQueue ? (
        <div className="space-y-3">
          {items.map((testimonial) => (
            <ModerationCard
              key={testimonial.publicId}
              testimonial={testimonial}
              canModerate={canModerate}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border">
          <ul className="divide-y">
            {items.map((testimonial) => (
              <PublishedRow
                key={testimonial.publicId}
                testimonial={testimonial}
                canModerate={canModerate}
              />
            ))}
          </ul>
        </div>
      )}

      <CollectManuallyDialog open={collectOpen} onOpenChange={setCollectOpen} />
    </div>
  )
}

function CourseFilter({
  course,
  onCourseChange,
}: {
  course: string
  onCourseChange: (course: string) => void
}) {
  const coursesQuery = useQuery(testimonialCourseOptionsQueryOptions())
  return (
    <select
      aria-label="Course filter"
      className="border-input bg-background flex h-9 w-56 rounded-md border px-3 text-sm"
      value={course}
      onChange={(event) => onCourseChange(event.target.value)}
    >
      <option value="all">All courses</option>
      {(coursesQuery.data ?? []).map((option) => (
        <option key={option.publicId} value={option.publicId}>
          {option.title}
        </option>
      ))}
    </select>
  )
}

function TriggerSettingsCard() {
  const settingsQuery = useQuery(testimonialSettingsQueryOptions())
  const save = useSaveTestimonialSettings()
  const settings = settingsQuery.data?.settings

  if (!settings) return null

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-sm">Collection trigger</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.onCompletion}
            onChange={(event) =>
              void save.mutateAsync({ ...settings, onCompletion: event.target.checked })
            }
            className="accent-primary"
          />
          On course completion
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.onFiveStar}
            onChange={(event) =>
              void save.mutateAsync({ ...settings, onFiveStar: event.target.checked })
            }
            className="accent-primary"
          />
          On 5-star course rating
        </label>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Display:</span>
          <select
            aria-label="Display format"
            className="border-input bg-background flex h-8 w-40 rounded-md border px-2 text-sm"
            value={settings.displayFormat}
            onChange={(event) =>
              void save.mutateAsync({
                ...settings,
                displayFormat: event.target.value as 'carousel',
              })
            }
          >
            <option value="carousel">Carousel</option>
            <option value="grid">Grid</option>
            <option value="highlight">Single highlight quote</option>
          </select>
        </div>
      </CardContent>
    </Card>
  )
}

function RatingStars({ rating }: { rating: number | null }) {
  if (rating == null) return null
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <StarIcon
          key={index}
          className={
            index < rating ? 'size-4 fill-warning text-warning' : 'size-4 text-muted-foreground'
          }
          aria-hidden
        />
      ))}
    </span>
  )
}

function ModerationCard({
  testimonial,
  canModerate,
}: {
  testimonial: TestimonialRow
  canModerate: boolean
}) {
  const decide = useDecideTestimonial()
  const [editOpen, setEditOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [editedQuote, setEditedQuote] = useState(testimonial.quote)
  const [editNote, setEditNote] = useState('')

  // Spec: approve is disabled until the consent checkbox is verified.
  const consentVerified = testimonial.consentConfirmed

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <blockquote className="text-sm">
          “{testimonial.quote}” <RatingStars rating={testimonial.rating} />
        </blockquote>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            — {testimonial.studentName}, {testimonial.courseTitle}
            {testimonial.courseRating != null
              ? ` (course rating ${testimonial.courseRating.toFixed(1)})`
              : ''}
          </span>
          <span>{format(new Date(testimonial.createdAt), 'MMM d, yyyy')}</span>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={consentVerified}
            readOnly
            disabled
            className="accent-primary"
          />
          Consent to display publicly {consentVerified ? 'confirmed' : 'not confirmed'}
        </label>

        {canModerate ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!consentVerified || decide.isPending}
              title={consentVerified ? undefined : 'Consent must be confirmed before approval'}
              onClick={() =>
                void decide.mutateAsync({
                  testimonialPublicId: testimonial.publicId,
                  decision: 'approve',
                })
              }
            >
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              Edit quote
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => setRejectOpen(true)}
            >
              Reject
            </Button>
          </div>
        ) : null}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit quote</DialogTitle>
            <DialogDescription>
              Light edits only — heavier changes are flagged for student re-confirmation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edited-quote">Quote</Label>
              <Textarea
                id="edited-quote"
                value={editedQuote}
                onChange={(event) => setEditedQuote(event.target.value)}
                rows={4}
                maxLength={QUOTE_MAX_LENGTH}
              />
              <p className="text-xs text-muted-foreground">
                {editedQuote.trim().length}/{QUOTE_MAX_LENGTH} characters (min {QUOTE_MIN_LENGTH}).
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-note">Editor initials / note</Label>
              <Input
                id="edit-note"
                value={editNote}
                onChange={(event) => setEditNote(event.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const result = await decide.mutateAsync({
                  testimonialPublicId: testimonial.publicId,
                  decision: 'edit',
                  quote: editedQuote.trim(),
                  editNote: editNote || undefined,
                })
                if (result.heavyEdit) {
                  toast.warning('Heavy edit flagged — re-confirm the wording with the student.')
                } else {
                  toast.success('Quote edited.')
                }
                setEditOpen(false)
              }}
              disabled={decide.isPending || editedQuote.trim().length < QUOTE_MIN_LENGTH}
            >
              Save edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this submission?"
        body="The student is notified politely and the submission is archived for reference."
        confirmLabel="Reject"
        onConfirm={async () => {
          await decide.mutateAsync({
            testimonialPublicId: testimonial.publicId,
            decision: 'reject',
            rejectionReason: 'Not a fit for the landing page right now',
          })
          setRejectOpen(false)
        }}
      />
    </Card>
  )
}

function PublishedRow({
  testimonial,
  canModerate,
}: {
  testimonial: TestimonialRow
  canModerate: boolean
}) {
  const feature = useSetTestimonialFeatured()
  const [unfeatureOpen, setUnfeatureOpen] = useState(false)

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <blockquote className="text-sm">“{testimonial.quote}”</blockquote>
        <p className="mt-1 text-xs text-muted-foreground">
          — {testimonial.studentName}, {testimonial.courseTitle}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <RatingStars rating={testimonial.rating} />
        {testimonial.featured ? (
          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
            ★ Featured
          </span>
        ) : null}
        {canModerate ? (
          testimonial.featured ? (
            <Button size="sm" variant="ghost" onClick={() => setUnfeatureOpen(true)}>
              Unfeature
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void feature.mutateAsync({
                  testimonialPublicId: testimonial.publicId,
                  featured: true,
                })
              }
            >
              ★ Feature on landing page
            </Button>
          )
        ) : null}
      </div>

      {/* Spec: unfeaturing a live featured quote confirms first. */}
      <ConfirmDialog
        open={unfeatureOpen}
        onOpenChange={setUnfeatureOpen}
        title="Remove from the landing page?"
        body="This testimonial is featured and live. Removing it changes what prospective students see."
        confirmLabel="Unfeature"
        onConfirm={async () => {
          await feature.mutateAsync({ testimonialPublicId: testimonial.publicId, featured: false })
          setUnfeatureOpen(false)
        }}
      />
    </li>
  )
}

function CollectManuallyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const collect = useCollectTestimonialManually()
  const coursesQuery = useQuery(testimonialCourseOptionsQueryOptions())

  const [studentId, setStudentId] = useState('')
  const [coursePublicId, setCoursePublicId] = useState('')
  const [quote, setQuote] = useState('')
  const [rating, setRating] = useState('5')
  const [consent, setConsent] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Collect Manually</DialogTitle>
          <DialogDescription>
            Add a quote a student shared outside the automated flow. Consent must be verified before
            approval.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="collect-student">Student ID</Label>
            <Input
              id="collect-student"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              placeholder="Paste the student's id from their profile"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="collect-course">Course</Label>
            <select
              id="collect-course"
              aria-label="Course"
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
              value={coursePublicId}
              onChange={(event) => setCoursePublicId(event.target.value)}
            >
              <option value="">Choose a course…</option>
              {(coursesQuery.data ?? []).map((option) => (
                <option key={option.publicId} value={option.publicId}>
                  {option.title}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="collect-quote">Quote</Label>
            <Textarea
              id="collect-quote"
              value={quote}
              onChange={(event) => setQuote(event.target.value)}
              rows={4}
              maxLength={QUOTE_MAX_LENGTH}
            />
            <p className="text-xs text-muted-foreground">
              {quote.trim().length}/{QUOTE_MAX_LENGTH} characters (min {QUOTE_MIN_LENGTH}).
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="collect-rating">Rating</Label>
            <select
              id="collect-rating"
              aria-label="Rating"
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={String(value)}>
                  {value} star{value === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="accent-primary"
            />
            Consent to display publicly confirmed
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await collect.mutateAsync({
                studentId: studentId.trim(),
                coursePublicId,
                quote: quote.trim(),
                rating: Number(rating),
                consentConfirmed: consent,
              })
              onOpenChange(false)
              setStudentId('')
              setCoursePublicId('')
              setQuote('')
              setRating('5')
              setConsent(false)
            }}
            disabled={
              collect.isPending ||
              !studentId.trim() ||
              !coursePublicId ||
              quote.trim().length < QUOTE_MIN_LENGTH
            }
          >
            Add to queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
