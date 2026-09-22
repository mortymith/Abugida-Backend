import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { PlusSignIcon, EyeIcon, ShieldUserIcon } from '@hugeicons/core-free-icons'
import { Badge } from '#/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import {
  consentLogQueryOptions,
  dataRequestsQueryOptions,
  privacyQueryOptions,
} from '../hooks/settings.queries'
import {
  useCompleteDataExport,
  useCreateDataRequest,
  useEraseStudentData,
  useSaveRetentionPolicy,
} from '../hooks/settings.mutations'
import { CheckboxRow } from './settings.setting-controls'
import { RETENTION_INACTIVITY_OPTIONS, RETENTION_WARNING_OPTIONS } from '../settings.constants'
import type { RetentionPolicy } from '../settings.types'

/**
 * S-6.10 Privacy & Data Retention — retention policies with a real match
 * preview, the data-subject request queue with SLA countdowns, and the
 * consent log. Destructive erasure is typed-confirmed ("Type ERASE") and
 * audited; financial records are always retained per spec.
 */

function PoliciesTab() {
  const query = useQuery(privacyQueryOptions())
  const save = useSaveRetentionPolicy()
  const preview = useQuery({
    queryKey: ['settings', 'privacy-preview'],
    queryFn: async () => {
      const { previewRetentionMatches } = await import('../server/all')
      return previewRetentionMatches()
    },
  })
  const [policy, setPolicy] = useState<RetentionPolicy | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (query.data && !policy) setPolicy(query.data.policy)
  }, [query.data, policy])

  if (query.isPending) return <Skeleton className="h-80 w-full" />
  if (query.isError) {
    return <RetryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
  }
  if (!policy) return null

  const saved = query.data.policy
  const dirty = JSON.stringify(policy) !== JSON.stringify(saved)
  const scopeValid =
    policy.scopeProfile ||
    policy.scopeMessages ||
    policy.scopeCertificates ||
    !policy.anonymizeEnabled

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Retention Policies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3 rounded-md border p-4">
            <CheckboxRow
              id="anonymize-enabled"
              label="Anonymize inactive students"
              description="Anonymize PII after inactivity; keep progress for historical analytics."
              checked={policy.anonymizeEnabled}
              onChange={(checked) => setPolicy({ ...policy, anonymizeEnabled: checked })}
            />
            {policy.anonymizeEnabled ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="inactivity-months">Inactivity threshold</Label>
                    <select
                      id="inactivity-months"
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      value={policy.anonymizeInactivityMonths}
                      onChange={(event) =>
                        setPolicy({
                          ...policy,
                          anonymizeInactivityMonths: Number(event.target.value),
                        })
                      }
                    >
                      {RETENTION_INACTIVITY_OPTIONS.map((months) => (
                        <option key={months} value={months}>
                          {months} months
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="warning-days">Warning email before action</Label>
                    <select
                      id="warning-days"
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      value={policy.warningEmailDays}
                      onChange={(event) =>
                        setPolicy({ ...policy, warningEmailDays: Number(event.target.value) })
                      }
                    >
                      {RETENTION_WARNING_OPTIONS.map((days) => (
                        <option key={days} value={days}>
                          {days} days
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Scope</legend>
                  <CheckboxRow
                    id="scope-profile"
                    label="Profile & contact"
                    checked={policy.scopeProfile}
                    onChange={(checked) => setPolicy({ ...policy, scopeProfile: checked })}
                  />
                  <CheckboxRow
                    id="scope-messages"
                    label="Messages"
                    checked={policy.scopeMessages}
                    onChange={(checked) => setPolicy({ ...policy, scopeMessages: checked })}
                  />
                  <CheckboxRow
                    id="scope-certificates"
                    label="Certificates (kept for audit)"
                    checked={policy.scopeCertificates}
                    onChange={(checked) => setPolicy({ ...policy, scopeCertificates: checked })}
                  />
                </fieldset>
              </>
            ) : null}
          </div>

          <div className="space-y-3 rounded-md border p-4">
            <CheckboxRow
              id="delete-enabled"
              label="Delete students inactive for the threshold"
              description="Runs the deletion lifecycle on the users table after the inactivity threshold."
              checked={policy.deleteEnabled}
              onChange={(checked) => setPolicy({ ...policy, deleteEnabled: checked })}
            />
            {policy.deleteEnabled ? (
              <div className="space-y-2">
                <Label htmlFor="delete-months">Delete inactivity threshold</Label>
                <select
                  id="delete-months"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={policy.deleteInactivityMonths}
                  onChange={(event) =>
                    setPolicy({ ...policy, deleteInactivityMonths: Number(event.target.value) })
                  }
                >
                  {RETENTION_INACTIVITY_OPTIONS.map((months) => (
                    <option key={months} value={months}>
                      {months} months
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {!scopeValid ? (
            <p className="text-destructive text-sm" role="alert">
              Select at least one scope to anonymize.
            </p>
          ) : null}

          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">
              Currently matching:{' '}
              {preview.isPending
                ? '…'
                : `${preview.data?.anonymizeMatchCount ?? 0} students match the anonymize policy${
                    policy.deleteEnabled
                      ? ` · ${preview.data?.deleteMatchCount ?? 0} match the delete policy`
                      : ''
                  }`}
            </p>
            {preview.data && preview.data.anonymizeSample.length > 0 ? (
              <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                {preview.data.anonymizeSample.map((student) => (
                  <li key={student.id}>
                    {student.name} ({student.email})
                    {student.lastActiveAt
                      ? ` — last active ${new Date(student.lastActiveAt).toLocaleDateString()}`
                      : ' — never active'}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <Button
              disabled={!dirty || save.isPending || !scopeValid}
              onClick={() => setConfirmOpen(true)}
            >
              {save.isPending ? 'Saving…' : 'Save Policy'}
            </Button>
            <Button variant="ghost" disabled={!dirty} onClick={() => setPolicy(saved)}>
              Cancel
            </Button>
            <span className="text-muted-foreground text-xs">
              Changes require confirmation with an impact summary. Scheduled runs are executed by
              the retention job; the preview above always reflects live data.
            </span>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Apply retention policy?"
        body={`Impact: ${preview.data?.anonymizeMatchCount ?? 0} students currently match the anonymize policy${
          policy.deleteEnabled
            ? ` and ${preview.data?.deleteMatchCount ?? 0} the delete policy`
            : ''
        }. Matching students will be anonymized or deleted after their warning window. This is audited.`}
        confirmLabel="Apply Policy"
        onConfirm={async () => {
          await save.mutateAsync(policy)
        }}
      />
    </div>
  )
}

function RequestsTab() {
  const query = useQuery(dataRequestsQueryOptions())
  const create = useCreateDataRequest()
  const runExport = useCompleteDataExport()
  const erase = useEraseStudentData()

  const [createOpen, setCreateOpen] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [requestType, setRequestType] = useState<'export' | 'delete'>('export')
  const [studentIdError, setStudentIdError] = useState<string | null>(null)
  const [eraseTarget, setEraseTarget] = useState<string | null>(null)
  const [eraseTyping, setEraseTyping] = useState('')

  if (query.isPending) return <Skeleton className="h-64 w-full" />
  if (query.isError) {
    return <RetryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
  }

  const requests = query.data.items

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Data Requests</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setStudentId('')
            setStudentIdError(null)
            setCreateOpen(true)
          }}
        >
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} /> Record Request
        </Button>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <EmptyState
            variant="compact"
            title="No data-subject requests"
            description="Export or erase requests received from students are tracked here with statutory SLA countdowns."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.publicId}>
                    <TableCell>
                      <span className="font-medium">{request.studentName}</span>
                      <span className="text-muted-foreground block text-xs">
                        {request.studentEmail}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {request.requestType}
                      </Badge>
                      {request.status === 'completed' ? (
                        <Badge className="ml-1 bg-success/15 text-success">Done</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(request.requestedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {request.status === 'completed' ? (
                        <span className="text-muted-foreground text-xs">Completed</span>
                      ) : request.slaWarning ? (
                        <Badge className="bg-destructive/15 text-destructive">
                          {request.slaDaysLeft}d left
                        </Badge>
                      ) : (
                        <span className="text-xs">{request.slaDaysLeft}d left</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === 'open' ? (
                        request.requestType === 'export' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={runExport.isPending}
                            onClick={() => runExport.mutate(request.publicId)}
                          >
                            <HugeiconsIcon icon={EyeIcon} strokeWidth={2} className="size-3.5" />
                            Prepare Export
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setEraseTarget(request.publicId)
                              setEraseTyping('')
                            }}
                          >
                            <HugeiconsIcon
                              icon={ShieldUserIcon}
                              strokeWidth={2}
                              className="size-3.5"
                            />
                            Review & Erase
                          </Button>
                        )
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-muted-foreground mt-3 text-xs">
          Deletion scope never silently removes financial records: invoices and transactions are
          retained per tax rules. Legal-basis notes and the full trail live in the Security & Audit
          Log.
        </p>
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Data Request</DialogTitle>
            <DialogDescription>
              Log a data-subject request received from a student (email, form, or support ticket).
              The 30-day statutory SLA starts now.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="request-type">Request type</Label>
            <select
              id="request-type"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={requestType}
              onChange={(event) => setRequestType(event.target.value as 'export' | 'delete')}
            >
              <option value="export">Export (portable archive)</option>
              <option value="delete">Erase (irreversible)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="student-id">Student ID</Label>
            <Input
              id="student-id"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              placeholder="Paste the student's ID from the directory"
            />
            {studentIdError ? (
              <p className="text-destructive text-sm" role="alert">
                {studentIdError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={studentId.trim() === '' || create.isPending}
              onClick={async () => {
                const isUuid =
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                    studentId.trim(),
                  )
                if (!isUuid) {
                  setStudentIdError('Enter the student ID (UUID) from the directory profile URL.')
                  return
                }
                try {
                  await create.mutateAsync({
                    studentPublicId: studentId.trim(),
                    requestType,
                  })
                  setCreateOpen(false)
                } catch {
                  /* toast handled by mutation */
                }
              }}
            >
              {create.isPending ? 'Recording…' : 'Record Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eraseTarget != null} onOpenChange={(open) => !open && setEraseTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify identity, then erase</DialogTitle>
            <DialogDescription>
              Two-step confirmation: verify the requester's identity out-of-band, then type ERASE to
              irreversibly delete the student's PII. Financial records are retained per tax rules
              and a completion receipt is written to the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="erase-typing">Type ERASE to confirm</Label>
            <Input
              id="erase-typing"
              value={eraseTyping}
              onChange={(event) => setEraseTyping(event.target.value)}
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEraseTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={eraseTyping !== 'ERASE' || erase.isPending}
              onClick={async () => {
                if (!eraseTarget) return
                try {
                  await erase.mutateAsync({ publicId: eraseTarget, confirmation: 'ERASE' })
                  setEraseTarget(null)
                } catch {
                  /* toast handled by mutation */
                }
              }}
            >
              {erase.isPending ? 'Erasing…' : 'Erase Student Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function ConsentTab() {
  const [page, setPage] = useState(1)
  const query = useQuery(consentLogQueryOptions(page))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consent Log</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : query.isError ? (
          <RetryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
        ) : query.data.items.length === 0 ? (
          <EmptyState
            variant="compact"
            title="No consent records yet"
            description="Marketing opt-ins and terms acceptance appear here with timestamps and source."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Consent</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Granted</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.items.map((item) => (
                    <TableRow key={item.publicId}>
                      <TableCell>
                        <span className="font-medium">{item.studentName}</span>
                        <span className="text-muted-foreground block text-xs">
                          {item.studentEmail}
                        </span>
                      </TableCell>
                      <TableCell className="capitalize">
                        {item.consentType.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-xs">{item.consentVersion}</TableCell>
                      <TableCell>
                        {item.isGranted ? (
                          <Badge className="bg-success/15 text-success">Granted</Badge>
                        ) : (
                          <Badge variant="secondary">Revoked</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(item.consentedAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {query.data.totalPages > 1 ? (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Page {query.data.page} of {query.data.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= query.data.totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function PrivacyView() {
  const [tab, setTab] = useState<'policies' | 'requests' | 'consent'>('policies')

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Privacy & Data Retention</h1>
        <p className="text-muted-foreground text-sm">
          Automated retention policies, the data-subject request queue, and the consent log.
          Sensitive actions are dual-confirmed and fully audited.
        </p>
      </header>
      <div role="tablist" aria-label="Privacy sections" className="flex gap-1">
        {(
          [
            ['policies', 'Retention Policies'],
            ['requests', 'Data Requests'],
            ['consent', 'Consent Log'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={
              tab === value
                ? 'rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
                : 'text-muted-foreground rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted'
            }
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'policies' ? <PoliciesTab /> : tab === 'requests' ? <RequestsTab /> : <ConsentTab />}
    </div>
  )
}
