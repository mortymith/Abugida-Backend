import { useState } from 'react'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar03Icon } from '@hugeicons/core-free-icons'
import { cn } from 'cn'
import {
  DATE_RANGE_PRESETS,
  DATE_RANGE_PRESET_LABELS,
  hasCustomRange,
  validateCustomRange,
} from '../schemas/dashboard.date-range.schema'
import type { DateRangePreset } from '../schemas/dashboard.date-range.schema'

export interface DateRangeSelection {
  preset?: DateRangePreset
  from?: string
  to?: string
}

interface DateRangePickerProps {
  selection: DateRangeSelection
  /** Active label shown on the trigger (resolved by the page from data). */
  label: string
  /** Routes own their URL state; the picker only reports intent. */
  onChange: (next: DateRangeSelection) => void
  className?: string
}

/**
 * Date range selector (S-1.1 / S-1.2 header).
 *
 * Presets and a custom from/to range, with the custom range validated before it
 * is ever applied: **end ≥ start**, no future dates, at most 2 years. An invalid
 * entry is reported inline and the **last valid range stays applied**, so a typo
 * never blanks the screen behind it.
 *
 * The picker holds the draft from/to in local state because a half-typed date is
 * not a range; the URL only ever receives a validated pair.
 */
export function DateRangePicker({ selection, label, onChange, className }: DateRangePickerProps) {
  const [draft, setDraft] = useState<{ from: string; to: string }>({
    from: selection.from ?? '',
    to: selection.to ?? '',
  })
  const isCustom = hasCustomRange(selection)
  const validation = validateCustomRange(draft)

  function applyPreset(preset: DateRangePreset) {
    setDraft({ from: '', to: '' })
    onChange({ preset })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className={cn('gap-2', className)}>
            <HugeiconsIcon icon={Calendar03Icon} size={16} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Date range</DropdownMenuLabel>
          {DATE_RANGE_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset}
              onClick={() => applyPreset(preset)}
              className={selection.preset === preset && !isCustom ? 'bg-accent' : undefined}
            >
              {DATE_RANGE_PRESET_LABELS[preset]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <div className="grid gap-2 px-2 py-1.5">
            <label className="grid gap-1 text-xs text-muted-foreground">
              From
              <input
                type="date"
                aria-label="Custom range start"
                aria-invalid={!validation.ok && validation.field === 'from'}
                className={cn(
                  'h-8 rounded-md border bg-background px-2 text-sm text-foreground',
                  !validation.ok && validation.field === 'from' && 'border-destructive',
                )}
                value={draft.from}
                onChange={(event) => setDraft((prev) => ({ ...prev, from: event.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              To
              <input
                type="date"
                aria-label="Custom range end"
                aria-invalid={!validation.ok && validation.field === 'to'}
                className={cn(
                  'h-8 rounded-md border bg-background px-2 text-sm text-foreground',
                  !validation.ok && validation.field === 'to' && 'border-destructive',
                )}
                value={draft.to}
                onChange={(event) => setDraft((prev) => ({ ...prev, to: event.target.value }))}
              />
            </label>
            {!validation.ok ? (
              <p role="alert" className="text-xs text-destructive">
                {validation.message}
              </p>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={!validation.ok || (!draft.from && !draft.to)}
              onClick={() => onChange({ from: draft.from, to: draft.to })}
            >
              Apply custom range
            </Button>
            {isCustom ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft({ from: '', to: '' })
                  onChange({ preset: selection.preset ?? '30d' })
                }}
              >
                Clear custom range
              </Button>
            ) : null}
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
