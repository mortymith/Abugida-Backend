import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { HugeiconsIcon } from '@hugeicons/react'
import { Table01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'

export interface ChartTableRow {
  /** Bucket label, e.g. "Mar 15". */
  label: string
  value: number
}

interface ChartFigureProps {
  /** The chart itself. */
  children: ReactNode
  /** Accessible name for the figure. */
  label: string
  /** Data for the on-demand table. Not rendered until it is asked for. */
  rows: readonly ChartTableRow[]
  /** Formats a value cell; defaults to a plain number. */
  formatValue?: (value: number) => string
  /** Column header for the value column. */
  valueHeader?: string
}

/**
 * Chart + **on-demand data table** (spec S-1.1 / S-1.2 Keyboard & Focus).
 *
 * Every chart in the product has a table equivalent, and the table is the
 * screen-reader alternative — but it is **not rendered until it is requested**:
 * a screen full of hidden 30-row tables is a real cost against the LCP budget
 * for a reader who never asks for one.
 *
 * The toggle is a real button, so it is keyboard reachable and announces its
 * state with `aria-expanded`; the table it controls is labelled by it.
 */
export function ChartFigure({
  children,
  label,
  rows,
  formatValue = (value) => value.toLocaleString('en-US'),
  valueHeader = 'Value',
}: ChartFigureProps) {
  const [showTable, setShowTable] = useState(false)
  const tableId = `chart-table-${label.replace(/\W+/g, '-').toLowerCase()}`

  return (
    <div className="flex flex-col gap-2">
      {children}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
          aria-expanded={showTable}
          aria-controls={showTable ? tableId : undefined}
          onClick={() => setShowTable((open) => !open)}
        >
          <HugeiconsIcon
            icon={showTable ? Cancel01Icon : Table01Icon}
            size={14}
            strokeWidth={2}
            aria-hidden="true"
          />
          {showTable ? 'Hide data table' : 'View as table'}
        </Button>
      </div>
      {showTable ? (
        <div id={tableId} className="max-h-64 overflow-auto rounded-md border">
          <Table>
            <caption className="sr-only">{label}</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Period</TableHead>
                <TableHead scope="col" className="text-right">
                  {valueHeader}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatValue(row.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  )
}
