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
import { DATE_RANGE_PRESETS } from '../schemas/dashboard.date-range.schema'
import type { DateRangePreset } from '../schemas/dashboard.date-range.schema'

const PRESET_LABELS: Record<DateRangePreset, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12mo': 'Last 12 months',
}

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
}

/**
 * Date range selector (S-1.1/S-1.2 header). Presets and custom from/to dates
 * are owned by the route's search params; native date inputs avoid pulling a
 * calendar dependency for v1.
 */
export function DateRangePicker({ selection, label, onChange }: DateRangePickerProps) {
  const isCustom = Boolean(selection.from || selection.to)

  function apply(next: DateRangeSelection) {
    onChange(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2">
            <HugeiconsIcon icon={Calendar03Icon} size={16} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Date range</DropdownMenuLabel>
          {DATE_RANGE_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset}
              onClick={() => apply({ preset })}
              className={selection.preset === preset && !isCustom ? 'bg-accent' : undefined}
            >
              {PRESET_LABELS[preset]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <div className="grid gap-2 px-2 py-1.5">
            <label className="grid gap-1 text-xs text-muted-foreground">
              From
              <input
                type="date"
                aria-label="Custom range start"
                className="h-8 rounded-md border bg-background px-2 text-sm"
                value={selection.from ?? ''}
                onChange={(event) => {
                  if (event.target.value) {
                    apply({ from: event.target.value, to: selection.to })
                  }
                }}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              To
              <input
                type="date"
                aria-label="Custom range end"
                className="h-8 rounded-md border bg-background px-2 text-sm"
                value={selection.to ?? ''}
                onChange={(event) => {
                  if (event.target.value) {
                    apply({ from: selection.from, to: event.target.value })
                  }
                }}
              />
            </label>
            {isCustom ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => apply({ preset: selection.preset ?? '30d' })}
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
