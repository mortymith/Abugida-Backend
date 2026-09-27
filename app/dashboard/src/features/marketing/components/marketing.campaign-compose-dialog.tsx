import { useEffect, useMemo, useState } from 'react'
import { EyeIcon, SendIcon, TimerIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { Button } from '#/components/ui/button'
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
import { toast } from '#/components/common/toast'
import { composerReferenceQueryOptions } from '../hooks/marketing.queries'
import {
  useCreateCampaign,
  usePreviewAudience,
  useScheduleCampaign,
  useSendCampaignNow,
  useSendTestCampaign,
} from '../hooks/marketing.mutations'
import { LARGE_SEND_THRESHOLD, requiresLargeSendConfirmation } from '../marketing.campaign-states'
import type { CampaignAudience } from '@abugida/database/marketing'

const NATIVE_SELECT_CLASS =
  'border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm'

/**
 * S-8.1 compose flow: pick a template, build the audience segment, then send
 * a test, schedule, or send now. Segment-empty audiences block sending and
 * large sends require the S-7.1 confirmation with the final count.
 */
export function CampaignComposeDialog({
  open,
  onOpenChange,
  prefillCohort,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefillCohort?: string
}) {
  const referenceQuery = useQuery(composerReferenceQueryOptions())

  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState('')
  const [templatePublicId, setTemplatePublicId] = useState('')
  const [cohortPublicId, setCohortPublicId] = useState('any')
  const [coursePublicId, setCoursePublicId] = useState('any')
  const [activity, setActivity] = useState<CampaignAudience['activity']>('any')

  useEffect(() => {
    if (!open) return
    setCohortPublicId(prefillCohort ?? 'any')
  }, [open, prefillCohort])

  const audience = useMemo<CampaignAudience>(
    () => ({
      cohortPublicIds: cohortPublicId === 'any' ? [] : [cohortPublicId],
      coursePublicIds: coursePublicId === 'any' ? [] : [coursePublicId],
      tags: [],
      activity,
    }),
    [cohortPublicId, coursePublicId, activity],
  )

  const createCampaign = useCreateCampaign()
  const previewAudience = usePreviewAudience()
  const sendNow = useSendCampaignNow()
  const schedule = useScheduleCampaign()
  const sendTest = useSendTestCampaign()

  const [preview, setPreview] = useState<{ count: number; matched: number } | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [largeSendTarget, setLargeSendTarget] = useState<string | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduledFor, setScheduledFor] = useState('')

  const canSave = name.trim().length > 0 && subject.trim().length > 0

  const reset = () => {
    setName('')
    setSubject('')
    setPreheader('')
    setTemplatePublicId('')
    setCohortPublicId('any')
    setCoursePublicId('any')
    setActivity('any')
    setPreview(null)
    setDraftId(null)
  }

  /** Create the draft once, reuse it for subsequent checks/sends. */
  const handlePreview = async (): Promise<string | undefined> => {
    if (!canSave) {
      toast.warning('A campaign name and subject are required.')
      return undefined
    }
    let campaignPublicId = draftId ?? undefined
    if (!campaignPublicId) {
      const result = await createCampaign.mutateAsync({
        name,
        subject,
        preheader: preheader || undefined,
        templatePublicId: templatePublicId || undefined,
        audience,
      })
      campaignPublicId = result.campaignPublicId
      setDraftId(campaignPublicId)
    }
    const count = await previewAudience.mutateAsync({ audience })
    setPreview({ count: count.count, matched: count.matched })
    return campaignPublicId
  }

  /**
   * Send pipeline: refresh the final deliverable count, block on empty
   * segments, and require S-7.1 confirmation above the large-send threshold.
   */
  const handleSendNow = async (campaignPublicId: string) => {
    const count = await previewAudience.mutateAsync({ audience })
    if (count.count === 0) {
      toast.error('This audience matches 0 recipients — adjust filters.')
      return
    }
    if (requiresLargeSendConfirmation(count.count)) {
      setLargeSendTarget(campaignPublicId)
      return
    }
    await doSend(campaignPublicId)
  }

  const doSend = async (campaignPublicId: string) => {
    await sendNow.mutateAsync({ campaignPublicId })
    onOpenChange(false)
    reset()
  }

  const handleSchedule = async (campaignPublicId: string) => {
    if (!scheduledFor) {
      toast.warning('Pick a future date and time first.')
      return
    }
    const count = await previewAudience.mutateAsync({ audience })
    if (count.count === 0) {
      toast.error('This audience matches 0 recipients — adjust filters.')
      return
    }
    await schedule.mutateAsync({
      campaignPublicId,
      scheduledFor: new Date(scheduledFor).toISOString(),
    })
    setScheduleOpen(false)
    onOpenChange(false)
    reset()
  }

  const reference = referenceQuery.data
  const pending =
    createCampaign.isPending || previewAudience.isPending || sendNow.isPending || schedule.isPending

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
            <DialogDescription>
              Pick a template, build the audience segment, then send a test, schedule, or send now.
              Marketing audiences automatically exclude unsubscribed and bounced students.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="campaign-name">Campaign name</Label>
              <Input
                id="campaign-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Sept. TOEFL push"
                maxLength={200}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="campaign-subject">Subject</Label>
              <Input
                id="campaign-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="{{course_name}} starts {{start_date}} — save your seat"
                maxLength={150}
                aria-describedby="campaign-subject-hint"
              />
              <p id="campaign-subject-hint" className="text-xs text-muted-foreground">
                Required. Merge tags are validated against the chosen template.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="campaign-preheader">Preheader</Label>
              <Input
                id="campaign-preheader"
                value={preheader}
                onChange={(event) => setPreheader(event.target.value)}
                placeholder="Seats are limited…"
                maxLength={300}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="campaign-template">Template</Label>
              <select
                id="campaign-template"
                aria-label="Template"
                className={NATIVE_SELECT_CLASS}
                value={templatePublicId}
                onChange={(event) => setTemplatePublicId(event.target.value)}
              >
                <option value="">Choose a template…</option>
                {(reference?.templates ?? []).map((template) => (
                  <option key={template.publicId} value={template.publicId}>
                    {template.name} · v{template.currentVersion}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">Audience segment</legend>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="campaign-cohort">Cohort</Label>
                  <select
                    id="campaign-cohort"
                    aria-label="Cohort filter"
                    className={NATIVE_SELECT_CLASS}
                    value={cohortPublicId}
                    onChange={(event) => setCohortPublicId(event.target.value)}
                  >
                    <option value="any">Any cohort</option>
                    {(reference?.cohorts ?? []).map((cohort) => (
                      <option key={cohort.publicId} value={cohort.publicId}>
                        {cohort.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="campaign-course">Course</Label>
                  <select
                    id="campaign-course"
                    aria-label="Course filter"
                    className={NATIVE_SELECT_CLASS}
                    value={coursePublicId}
                    onChange={(event) => setCoursePublicId(event.target.value)}
                  >
                    <option value="any">Any course</option>
                    {(reference?.courses ?? []).map((course) => (
                      <option key={course.publicId} value={course.publicId}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="campaign-activity">Activity</Label>
                  <select
                    id="campaign-activity"
                    aria-label="Activity filter"
                    className={NATIVE_SELECT_CLASS}
                    value={activity}
                    onChange={(event) =>
                      setActivity(event.target.value as CampaignAudience['activity'])
                    }
                  >
                    <option value="any">All contacts</option>
                    <option value="active_30d">Active in last 30 days</option>
                    <option value="inactive_30d">Inactive for 30+ days</option>
                    <option value="completed">Completed at least one course</option>
                  </select>
                </div>
              </div>
            </fieldset>

            {preview ? (
              <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
                Final deliverable audience:{' '}
                <strong className="tabular-nums">{preview.count}</strong> recipients (
                {preview.matched} match before consent/suppression filters).
                {preview.count === 0
                  ? ' Sending is blocked until the segment matches someone.'
                  : ''}
              </p>
            ) : null}
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void sendTest.mutateAsync({ templatePublicId: templatePublicId || undefined })
              }
              disabled={pending || !templatePublicId}
            >
              <EyeIcon aria-hidden /> Send Test
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setScheduleOpen(true)}
              disabled={!canSave || pending}
            >
              <TimerIcon aria-hidden /> Schedule
            </Button>
            <Button
              type="button"
              onClick={() => void handlePreview()}
              disabled={!canSave || pending}
            >
              Check audience
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const id = await handlePreview()
                if (id) await handleSendNow(id)
              }}
              disabled={!canSave || pending}
            >
              <SendIcon aria-hidden /> Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* S-7.1 large-send confirmation with the final count (spec S-8.1). */}
      <ConfirmDialog
        open={largeSendTarget != null}
        onOpenChange={(nextOpen) => !nextOpen && setLargeSendTarget(null)}
        title="Send to a large audience?"
        body={`This campaign will be sent to more than ${LARGE_SEND_THRESHOLD} recipients. The final deliverable count is locked at send time — unsubscribed and bounced students are excluded automatically.`}
        confirmLabel="Send now"
        destructive={false}
        onConfirm={async () => {
          if (largeSendTarget) await doSend(largeSendTarget)
        }}
      />

      {/* Schedule dialog (fires in the S-6.1 workspace timezone). */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule send</DialogTitle>
            <DialogDescription>
              The campaign fires at the workspace timezone you set in Settings → General.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="campaign-schedule-at">Date and time</Label>
            <Input
              id="campaign-schedule-at"
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const id = await handlePreview()
                if (id) await handleSchedule(id)
              }}
              disabled={pending || !scheduledFor}
            >
              {schedule.isPending ? <Skeleton className="size-4" /> : null}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
