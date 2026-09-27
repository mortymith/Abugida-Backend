import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '#/components/ui/input'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { Skeleton } from '#/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import {
  generalSettingsReferenceQueryOptions,
  generalSettingsQueryOptions,
} from '../hooks/settings.queries'
import { useSaveGeneralSettings } from '../hooks/settings.mutations'
import { CheckboxRow, SaveBar, SettingRow } from './settings.setting-controls'
import { COMMON_TIMEZONES, DATE_FORMATS } from '../settings.constants'
import type { GeneralSettings } from '../settings.types'

/**
 * S-6.1 General Settings — platform, course, and notification configuration
 * (admin only). Form state is local until Save; the spec's default, unsaved,
 * saving, success, and error states are all rendered.
 */

interface GeneralForm {
  platformName: string
  supportEmail: string
  timezone: string
  dateFormat: (typeof DATE_FORMATS)[number]
  defaultInstructorId: string
  defaultCategoryId: string
  autoNotifyOnPublication: boolean
  dailyDigestEmails: boolean
}

function defaults(settings: GeneralSettings | undefined): GeneralForm {
  const dateFormat = DATE_FORMATS.find((format) => format === settings?.dateFormat)
  return {
    platformName: settings?.platformName ?? '',
    supportEmail: settings?.supportEmail ?? '',
    timezone: settings?.timezone ?? 'Africa/Addis_Ababa',
    dateFormat: dateFormat ?? 'DD/MM/YYYY',
    defaultInstructorId: settings?.defaultInstructorId ?? '',
    defaultCategoryId:
      settings?.defaultCategoryId != null ? String(settings.defaultCategoryId) : '',
    autoNotifyOnPublication: settings?.autoNotifyOnPublication ?? false,
    dailyDigestEmails: settings?.dailyDigestEmails ?? false,
  }
}

export function GeneralSettingsView() {
  const settingsQuery = useQuery(generalSettingsQueryOptions())
  const referenceQuery = useQuery(generalSettingsReferenceQueryOptions())
  const save = useSaveGeneralSettings()

  const [form, setForm] = useState<GeneralForm>(() => defaults(undefined))
  const [dirty, setDirty] = useState(false)

  const data = settingsQuery.data
  useEffect(() => {
    // Populate once server data arrives; afterwards local edits win until save.
    if (data && !dirty) setForm(defaults(data))
  }, [data, dirty])

  if (settingsQuery.isPending || referenceQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (settingsQuery.isError) {
    return (
      <RetryErrorState
        onRetry={() => void settingsQuery.refetch()}
        isRetrying={settingsQuery.isFetching}
      />
    )
  }

  const isDirty = dirty && JSON.stringify(form) !== JSON.stringify(defaults(data))

  useEffect(() => {
    if (save.isSuccess) setDirty(false)
  }, [save.isSuccess])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          System-wide settings, configurations, and preferences.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Platform Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <SettingRow label="Platform Name" htmlFor="platform-name" required>
            <Input
              id="platform-name"
              value={form.platformName}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, platformName: event.target.value }))
                setDirty(true)
              }}
              placeholder="Abugida Academy"
            />
          </SettingRow>
          <SettingRow label="Support Email" htmlFor="support-email" required>
            <Input
              id="support-email"
              type="email"
              value={form.supportEmail}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, supportEmail: event.target.value }))
                setDirty(true)
              }}
              placeholder="support@abugida.com"
            />
          </SettingRow>
          <SettingRow label="Timezone" htmlFor="timezone">
            <select
              id="timezone"
              aria-label="Timezone"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm sm:w-72"
              value={form.timezone}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, timezone: event.target.value }))
                setDirty(true)
              }}
            >
              {[...new Set([form.timezone, ...COMMON_TIMEZONES])].map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </SettingRow>
          <SettingRow label="Date Format" htmlFor="date-format">
            <select
              id="date-format"
              aria-label="Date format"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm sm:w-72"
              value={form.dateFormat}
              onChange={(event) => {
                setForm((prev) => ({
                  ...prev,
                  dateFormat: event.target.value as GeneralForm['dateFormat'],
                }))
                setDirty(true)
              }}
            >
              {DATE_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Course Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <SettingRow label="Default Instructor" htmlFor="default-instructor">
            <select
              id="default-instructor"
              aria-label="Default instructor"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm sm:w-72"
              value={form.defaultInstructorId}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, defaultInstructorId: event.target.value }))
                setDirty(true)
              }}
            >
              <option value="">Select</option>
              {(referenceQuery.data?.instructors ?? []).map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.name}
                </option>
              ))}
            </select>
          </SettingRow>
          <SettingRow label="Default Category" htmlFor="default-category">
            <select
              id="default-category"
              aria-label="Default category"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm sm:w-72"
              value={form.defaultCategoryId}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, defaultCategoryId: event.target.value }))
                setDirty(true)
              }}
            >
              <option value="">Select</option>
              {(referenceQuery.data?.categories ?? []).map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <CheckboxRow
            id="auto-notify"
            label="Auto-notify on course publication"
            description="Email enrolled students when a course is published."
            checked={form.autoNotifyOnPublication}
            onChange={(checked) => {
              setForm((prev) => ({ ...prev, autoNotifyOnPublication: checked }))
              setDirty(true)
            }}
          />
          <CheckboxRow
            id="daily-digest"
            label="Daily digest emails"
            description="Send staff a daily summary of platform activity."
            checked={form.dailyDigestEmails}
            onChange={(checked) => {
              setForm((prev) => ({ ...prev, dailyDigestEmails: checked }))
              setDirty(true)
            }}
          />
        </CardContent>
      </Card>

      <SaveBar
        dirty={isDirty}
        saving={save.isPending}
        error={save.isError ? 'Unable to save settings. Retry?' : null}
        onSave={() =>
          save.mutate({
            platformName: form.platformName.trim(),
            supportEmail: form.supportEmail.trim(),
            timezone: form.timezone,
            dateFormat: form.dateFormat,
            defaultInstructorId: form.defaultInstructorId || null,
            defaultCategoryId: form.defaultCategoryId ? Number(form.defaultCategoryId) : null,
            autoNotifyOnPublication: form.autoNotifyOnPublication,
            dailyDigestEmails: form.dailyDigestEmails,
          })
        }
        onCancel={() => {
          setForm(defaults(data))
          setDirty(false)
        }}
      />
    </div>
  )
}
