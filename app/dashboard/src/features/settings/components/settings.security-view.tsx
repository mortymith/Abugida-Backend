import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
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
import { Badge } from '#/components/ui/badge'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { auditLogQueryOptions, securityPoliciesQueryOptions } from '../hooks/settings.queries'
import { useSaveSecurityPolicies } from '../hooks/settings.mutations'
import { exportAuditLogCsv } from '../server/all'
import { CheckboxRow, SaveBar } from './settings.setting-controls'
import type { AuditLogQuery } from '../schemas/settings.schema'
import { toast } from 'sonner'

/**
 * S-6.8 Security & Audit Log — workspace security policies (Policies tab)
 * and the searchable, exportable audit trail (Audit Log tab), both admin
 * only. The audit log is append-only: reads here, writes come from the
 * actions themselves.
 */

const SESSION_TIMEOUT_OPTIONS = [1, 4, 8, 12, 24, 72] as const
const ACTION_FILTERS = [
  'admin_action',
  'data_export',
  'permission_change',
  'user_login',
  'user_logout',
] as const

function PoliciesTab() {
  const query = useQuery(securityPoliciesQueryOptions())
  const save = useSaveSecurityPolicies()

  const [requireMfa, setRequireMfa] = useState(false)
  const [timeoutHours, setTimeoutHours] = useState('8')
  const [ipRanges, setIpRanges] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const policies = query.data
    if (policies && !loaded) {
      setRequireMfa(policies.requireAdminMfa)
      setTimeoutHours(
        policies.sessionTimeoutHours != null ? String(policies.sessionTimeoutHours) : '',
      )
      setIpRanges(policies.allowedIpRanges.join(', '))
      setLoaded(true)
    }
  }, [query.data, loaded])

  if (query.isPending) return <Skeleton className="h-64 w-full" />
  if (query.isError) {
    return <RetryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
  }

  const policies = query.data
  const parsedRanges = ipRanges
    .split(',')
    .map((range) => range.trim())
    .filter(Boolean)
  const timeoutValue = timeoutHours === '' ? null : Number(timeoutHours)
  const invalidTimeout =
    timeoutValue != null &&
    (!Number.isInteger(timeoutValue) || timeoutValue < 1 || timeoutValue > 720)
  const invalidRange = parsedRanges.some((range) => !/^[0-9a-fA-F.:/]+$/.test(range))
  const dirty =
    requireMfa !== policies.requireAdminMfa ||
    (timeoutHours === '' ? null : Number(timeoutHours)) !== policies.sessionTimeoutHours ||
    parsedRanges.join(', ') !== policies.allowedIpRanges.join(', ')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Policies</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <CheckboxRow
          id="require-admin-mfa"
          label="Require MFA for all Admins"
          description="Admins without two-factor enabled are prompted to enroll at next sign-in."
          checked={requireMfa}
          onChange={setRequireMfa}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="session-timeout">Session Timeout (hours)</Label>
            <select
              id="session-timeout"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={timeoutHours}
              onChange={(event) => setTimeoutHours(event.target.value)}
            >
              <option value="">No forced timeout</option>
              {SESSION_TIMEOUT_OPTIONS.map((hours) => (
                <option key={hours} value={String(hours)}>
                  {hours} {hours === 1 ? 'hour' : 'hours'}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ip-ranges">Allowed Login IP Ranges (optional)</Label>
            <Input
              id="ip-ranges"
              value={ipRanges}
              onChange={(event) => setIpRanges(event.target.value)}
              placeholder="10.0.0.0/8, 192.168.1.0/24"
            />
            {invalidRange ? (
              <p className="text-destructive text-xs">Ranges must be IPs or CIDR blocks.</p>
            ) : null}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">Sign-in Methods</h3>
          <div className="flex flex-wrap items-center gap-2">
            {policies.signInMethods.map((method) => (
              <Badge
                key={method.provider}
                className={
                  method.configured
                    ? 'bg-success/15 text-success capitalize'
                    : 'bg-muted text-muted-foreground capitalize'
                }
              >
                {method.provider} {method.configured ? '· enabled' : '· not configured'}
              </Badge>
            ))}
            <span className="text-muted-foreground text-xs">
              Configured server-side (see Integrations).
            </span>
          </div>
        </div>
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          error={
            invalidTimeout
              ? 'Session timeout must be 1–720 hours.'
              : save.isError
                ? 'Unable to save security policy. Retry?'
                : null
          }
          onSave={() =>
            save.mutate({
              requireAdminMfa: requireMfa,
              sessionTimeoutHours: timeoutValue,
              allowedIpRanges: parsedRanges,
            })
          }
          onCancel={() => setLoaded(false)}
        />
      </CardContent>
    </Card>
  )
}

function AuditLogTab() {
  const [filter, setFilter] = useState<AuditLogQuery>({})
  const [page, setPage] = useState(1)
  const query = useQuery(auditLogQueryOptions({ ...filter, page }))
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const result = await exportAuditLogCsv({ data: filter })
      const blob = new Blob([result.csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = result.fileName
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('Audit log exported.')
    } catch {
      toast.error('Unable to export audit log. Retry?')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Audit Log</CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleExport()}
          disabled={exporting}
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="audit-actor">Filter by actor</Label>
            <Input
              id="audit-actor"
              value={filter.actor ?? ''}
              placeholder="Name or email"
              onChange={(event) => {
                setPage(1)
                setFilter((prev) => ({
                  ...prev,
                  actor: event.target.value === '' ? undefined : event.target.value,
                }))
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-action">Filter by action</Label>
            <select
              id="audit-action"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={filter.action ?? ''}
              onChange={(event) => {
                setPage(1)
                setFilter((prev) => ({
                  ...prev,
                  action: event.target.value === '' ? undefined : event.target.value,
                }))
              }}
            >
              <option value="">All actions</option>
              {ACTION_FILTERS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
        </div>

        {query.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : query.isError ? (
          <RetryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
        ) : query.data.items.length === 0 ? (
          <EmptyState
            variant="compact"
            title="No matching audit entries"
            description="Adjust the actor or action filters to see more of the trail."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.items.map((item) => (
                    <TableRow key={item.publicId}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(item.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.actorName ?? item.actorEmail ?? 'System'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {item.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.resourceDescription ?? item.resourceType ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {query.data.page} of {query.data.totalPages} · {query.data.total} entries
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
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function SecurityView() {
  const [tab, setTab] = useState<'policies' | 'audit'>('policies')

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Security & Audit Log</h1>
        <p className="text-muted-foreground text-sm">
          Workspace security policy configuration and a searchable, exportable audit trail.
        </p>
      </header>
      <div role="tablist" aria-label="Security sections" className="flex gap-1">
        {(
          [
            ['policies', 'Policies'],
            ['audit', 'Audit Log'],
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
      {tab === 'policies' ? <PoliciesTab /> : <AuditLogTab />}
    </div>
  )
}
