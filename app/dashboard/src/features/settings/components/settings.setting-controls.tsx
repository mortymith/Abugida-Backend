import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { Spinner } from '#/components/ui/spinner'
import { cn } from '#/lib/utils'

/**
 * Shared form controls for Settings screens (spec 08): a labeled row with
 * description + control, and the Save Changes / Cancel bar with unsaved,
 * saving, and error states per the spec's screen states.
 */

export function SettingRow({
  label,
  htmlFor,
  description,
  required,
  children,
  className,
}: {
  label: string
  htmlFor?: string
  description?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('grid gap-2 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:gap-6', className)}
    >
      <div className="pt-1">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
          {required ? (
            <span aria-hidden="true" className="text-destructive">
              {' '}
              *
            </span>
          ) : null}
        </Label>
        {description ? <p className="text-muted-foreground mt-1 text-xs">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function CheckboxRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="border-input focus-visible:ring-ring mt-0.5 size-4 rounded focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
      />
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
      </div>
    </div>
  )
}

export function SaveBar({
  dirty,
  saving,
  error,
  onSave,
  onCancel,
  saveLabel = 'Save Changes',
}: {
  dirty: boolean
  saving: boolean
  error: string | null
  onSave: () => void
  onCancel: () => void
  saveLabel?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t pt-4">
      <Button type="button" onClick={onSave} disabled={!dirty || saving} className="min-w-36">
        {saving ? (
          <>
            <Spinner className="size-4" /> Saving…
          </>
        ) : (
          saveLabel
        )}
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel} disabled={!dirty || saving}>
        Cancel
      </Button>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
