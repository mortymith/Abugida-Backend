import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'
import { Badge } from '#/components/ui/badge'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { toast } from '#/components/common/toast'
import { PageHeader } from '#/components/common/page-header'
import { useSaveWorkspaceConfig, workspaceConfigQueryOptions } from '../'
import { SaveBar } from './settings.setting-controls'
import {
  MFA_REQUIRED_LABELS,
  MFA_REQUIRED_OPTIONS,
  SESSION_TIMEOUT_OPTIONS_MINUTES,
  formatSessionTimeout
  
} from '../settings.workspace-policies'
import type {WorkspacePolicyValue} from '../settings.workspace-policies';
import type { WorkspacePolicies } from '@abugida/database/auth'

/**
 * S-13.1 Workspace Configuration (spec 13).
 *
 * One screen showing every workspace policy in one place, so an Admin can
 * answer "what is configured here?" without reading five screens and guessing
 * the defaults. Each field shows its provenance — `workspace`, `plugin
 * default`, or `environment` — so a value nobody chose is visibly different
 * from a value somebody chose.
 *
 * The split is deliberate: **security-sensitive values are env-only** (the
 * Better Auth secret, provider credentials), **policy values are
 * workspace-configurable** and stored on the organization's `policies` jsonb
 * column. Env-set fields render read-only with a reason.
 *
 * Save semantics: `Save changes` is the section-level explicit save; the
 * 5 safety interlocks run server-side and a blocked save surfaces the field
 * + reason inline below the offending field.
 */
export function WorkspaceConfigView() {
  const query = useQuery(workspaceConfigQueryOptions())
  const save = useSaveWorkspaceConfig()

  // The draft is a partial over WorkspacePolicies. Only the keys the author
  // has touched are present; the server merges over the existing policies.
  const [draft, setDraft] = useState<Partial<WorkspacePolicies>>({})
  const [interlockError, setInterlockError] = useState<{
    field: string
    reason: string
  } | null>(null)

  // Reset the draft when the query data changes (e.g. after a save + refetch).
  useEffect(() => {
    if (query.data) setDraft({})
  }, [query.data])

  const dirty = useMemo(() => Object.keys(draft).length > 0, [draft])

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (query.isError) {
    return <RetryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
  }

  const config = query.data
  // After the pending + error checks, `config` is defined at runtime, but TS's
  // narrowing on `query.data` (a TanStack Query field) does not propagate
  // here. The runtime guard stays; the lint suppression documents the gap.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!config) return null

  function setField<TKey extends keyof WorkspacePolicies>(
    key: TKey,
    value: WorkspacePolicies[TKey],
  ): void {
    setDraft((prev) => ({ ...prev, [key]: value }))
    // Clear any interlock error on the field the author is now editing.
    setInterlockError((prev) => (prev?.field === key ? null : prev))
  }

  function handleSave() {
    if (!dirty) return
    setInterlockError(null)
    save.mutate(
      { policies: draft },
      {
        onSuccess: () => {
          setDraft({})
        },
        onError: (cause) => {
          const message = cause instanceof Error ? cause.message : 'Save failed'
          // The server throws INTERLOCK_BLOCKED:<field>:<reason> on a blocked
          // save. Parse it so the UI can show the message inline below the
          // offending field.
          const match = message.match(/^INTERLOCK_BLOCKED:([^:]+):(.+)$/)
          if (match) {
            setInterlockError({ field: match[1], reason: match[2] })
            toast.error(match[2])
          } else if (message.includes('NO_ACTIVE_WORKSPACE')) {
            toast.error('Only workspace admins can change these settings.')
          } else {
            toast.error(message.replace(/^[A-Z_]+:\s*/, ''))
          }
        },
      },
    )
  }

  function handleCancel() {
    setDraft({})
    setInterlockError(null)
  }

  // Partition the workspace entries into the three sections the spec's
  // wireframe shows: MEMBERS, INVITATIONS, SECURITY.
  const membersEntries = config.workspace.filter((entry) =>
    ['membershipLimit', 'allowUserToCreateOrganization', 'organizationLimit'].includes(entry.key),
  )
  const invitationsEntries = config.workspace.filter((entry) =>
    [
      'invitationExpiresInDays',
      'invitationLimit',
      'cancelPendingInvitationsOnReInvite',
    ].includes(entry.key),
  )
  const securityEntries = config.workspace.filter((entry) =>
    [
      'requireMfaFor',
      'sessionTimeoutMinutes',
      'sessionRevocationOnRoleChange',
    ].includes(entry.key),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Configuration"
        description="Every workspace policy in one place. Env-set values are read-only."
      />

      <WorkspaceConfigSection
        title="Members"
        entries={membersEntries}
        draft={draft}
        interlockError={interlockError}
        onFieldChange={setField}
      />

      <WorkspaceConfigSection
        title="Invitations"
        entries={invitationsEntries}
        draft={draft}
        interlockError={interlockError}
        onFieldChange={setField}
      />

      <WorkspaceConfigSection
        title="Security"
        entries={securityEntries}
        draft={draft}
        interlockError={interlockError}
        onFieldChange={setField}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Environment values (read-only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground text-xs">
            These values are set by environment variables and can’t be edited here. A redeploy is
            required to change them.
          </p>
          {config.environment.map((entry) => (
            <div
              key={entry.key}
              className="flex flex-wrap items-center justify-between gap-2 border-t pt-2"
            >
              <div>
                <p className="text-sm font-medium">{entry.label}</p>
                <p className="text-muted-foreground text-xs">{entry.range}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">{String(entry.value)}</span>
                <Badge variant="outline" className="text-xs">
                  environment
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        error={interlockError?.reason ?? null}
        onSave={handleSave}
        onCancel={handleCancel}
        saveLabel="Save changes"
      />
    </div>
  )
}

/**
 * One section of the S-13.1 wireframe (MEMBERS, INVITATIONS, SECURITY).
 * Renders the entries the spec groups together, with the provenance pill
 * and the interlock error inline below the offending field.
 */
function WorkspaceConfigSection({
  title,
  entries,
  draft,
  interlockError,
  onFieldChange,
}: {
  title: string
  entries: Array<{
    key: string
    value: WorkspacePolicyValue
    source: 'workspace' | 'plugin_default' | 'environment'
    defaultValue: WorkspacePolicyValue
    label: string
    range?: string
  }>
  draft: Partial<WorkspacePolicies>
  interlockError: { field: string; reason: string } | null
  onFieldChange: <TKey extends keyof WorkspacePolicies>(
    key: TKey,
    value: WorkspacePolicies[TKey],
  ) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.map((entry) => (
          <WorkspaceConfigField
            key={entry.key}
            entry={entry}
            draftValue={draft[entry.key as keyof WorkspacePolicies] ?? undefined}
            interlockReason={
              interlockError?.field === entry.key ? interlockError.reason : undefined
            }
            onFieldChange={onFieldChange}
          />
        ))}
      </CardContent>
    </Card>
  )
}

/**
 * One field in the S-13.1 surface. The control type is chosen by the policy
 * key: number input for limits, radio group for MFA audience, select for
 * session timeout, checkbox for booleans.
 */
function WorkspaceConfigField({
  entry,
  draftValue,
  interlockReason,
  onFieldChange,
}: {
  entry: {
    key: string
    value: WorkspacePolicyValue
    source: 'workspace' | 'plugin_default' | 'environment'
    defaultValue: WorkspacePolicyValue
    label: string
    range?: string
  }
  draftValue: WorkspacePolicyValue | undefined
  interlockReason: string | undefined
  onFieldChange: <TKey extends keyof WorkspacePolicies>(
    key: TKey,
    value: WorkspacePolicies[TKey],
  ) => void
}) {
  const key = entry.key as keyof WorkspacePolicies
  // The displayed value is the draft when the author has touched the field,
  // otherwise the resolved value from the server.
  const displayValue = draftValue !== undefined ? draftValue : entry.value

  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:gap-6">
      <div className="pt-1">
        <Label className="text-sm font-medium">{entry.label}</Label>
        {entry.range ? <p className="text-muted-foreground mt-1 text-xs">{entry.range}</p> : null}
        <ProvenancePill source={entry.source} defaultValue={entry.defaultValue} />
      </div>
      <div className="min-w-0">
        <FieldControl
          entryKey={key}
          value={displayValue}
          onChange={(value) =>
            onFieldChange(key, value as WorkspacePolicies[typeof key])
          }
        />
        {interlockReason ? (
          <p className="text-destructive mt-1 text-sm" role="alert">
            {interlockReason}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The provenance pill: shows where the value came from. When the value
 * differs from the default, the default is shown alongside: "7 days (plugin
 * default: 2 days)".
 */
function ProvenancePill({
  source,
  defaultValue,
}: {
  source: 'workspace' | 'plugin_default' | 'environment'
  defaultValue: WorkspacePolicyValue
}) {
  const label =
    source === 'workspace'
      ? 'workspace'
      : source === 'environment'
        ? 'environment'
        : 'plugin default'
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <Badge variant="outline" className="text-xs">
        {label}
      </Badge>
      {defaultValue !== null && source === 'workspace' ? (
        <span className="text-muted-foreground text-xs">
          plugin default: {String(defaultValue)}
        </span>
      ) : null}
    </div>
  )
}

/**
 * The control for one field. The control type is chosen by the policy key.
 */
function FieldControl({
  entryKey,
  value,
  onChange,
}: {
  entryKey: keyof WorkspacePolicies
  value: WorkspacePolicyValue
  onChange: (value: WorkspacePolicyValue) => void
}) {
  // Number inputs: membershipLimit, invitationLimit, organizationLimit,
  // invitationExpiresInDays.
  if (
    entryKey === 'membershipLimit' ||
    entryKey === 'invitationLimit' ||
    entryKey === 'organizationLimit' ||
    entryKey === 'invitationExpiresInDays'
  ) {
    return (
      <Input
        type="number"
        value={value === null ? '' : String(value)}
        onChange={(event) => {
          const raw = event.target.value
          onChange(raw === '' ? null : Number(raw))
        }}
        placeholder="Unlimited"
      />
    )
  }

  // MFA audience: radio group.
  if (entryKey === 'requireMfaFor') {
    const current = (value as string | null) ?? 'no_one'
    return (
      <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Require two-factor for">
        {MFA_REQUIRED_OPTIONS.map((option) => (
          <label key={option} className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="requireMfaFor"
              value={option}
              checked={current === option}
              onChange={() => onChange(option)}
            />
            {MFA_REQUIRED_LABELS[option]}
          </label>
        ))}
      </div>
    )
  }

  // Session timeout: select dropdown.
  if (entryKey === 'sessionTimeoutMinutes') {
    const current = value === null ? null : Number(value)
    return (
      <select
        className="border-input bg-background rounded-md border px-3 py-1.5 text-sm"
        value={current ?? ''}
        onChange={(event) => {
          const raw = event.target.value
          onChange(raw === '' ? null : Number(raw))
        }}
      >
        <option value="">Unconfigured</option>
        {SESSION_TIMEOUT_OPTIONS_MINUTES.map((minutes) => (
          <option key={minutes} value={minutes}>
            {formatSessionTimeout(minutes)}
          </option>
        ))}
      </select>
    )
  }

  // Booleans: cancelPendingInvitationsOnReInvite, allowUserToCreateOrganization,
  // sessionRevocationOnRoleChange.
  const checked = value === true
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {checked ? 'On' : 'Off'}
    </label>
  )
}
