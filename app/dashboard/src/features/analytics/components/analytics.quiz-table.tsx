import { Fragment, useState } from 'react'
import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table'
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
import { formatInteger } from '#/lib/format'
import type { QuizQuestionRow } from '../analytics.types'

const features = tableFeatures({})

interface QuizQuestionTableProps {
  questions: QuizQuestionRow[]
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/**
 * S-5.2 per-question table, sorted worst-first by correct %. Rows expand
 * in place to show the answer-choice distribution (spec drill-down).
 */
export function QuizQuestionTable({ questions }: QuizQuestionTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const helper = createColumnHelper<typeof features, QuizQuestionRow>()

  const columns = helper.columns([
    helper.accessor('prompt', {
      id: 'prompt',
      header: 'Prompt',
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="font-medium">Q{row.index + 1}</span>
          <span className="line-clamp-1 max-w-[28rem]">{row.original.prompt}</span>
          {row.original.flagged ? (
            <Badge variant="destructive" aria-label="Low-performing question">
              ⚠
            </Badge>
          ) : null}
        </span>
      ),
    }),
    helper.accessor('correctPct', {
      id: 'correctPct',
      header: 'Correct %',
      cell: (info) => {
        const value = info.getValue()
        return (
          <span
            className={`tabular-nums ${value != null && value < 50 ? 'font-medium text-destructive' : ''}`}
          >
            {value == null ? '—' : `${value}%`}
          </span>
        )
      },
    }),
    helper.accessor('avgTimeSeconds', {
      id: 'avgTimeSeconds',
      header: 'Avg Time',
      cell: (info) => (
        <span
          className="tabular-nums"
          title="Mean seconds between answers within an attempt (first answer vs attempt start)"
        >
          {formatDuration(info.getValue())}
        </span>
      ),
    }),
  ])

  const table = useTable({ data: questions, columns, features })

  if (questions.length === 0) {
    return (
      <EmptyState
        variant="compact"
        title="No attempts recorded yet for this quiz."
        description="Question-level statistics appear once students start answering."
      />
    )
  }

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => {
          const question = row.original
          const isOpen = expanded === question.questionId
          const hasDistribution = question.distribution.length > 0
          return (
            <Fragment key={row.id}>
              <TableRow
                className={hasDistribution ? 'cursor-pointer' : undefined}
                onClick={
                  hasDistribution
                    ? () => setExpanded(isOpen ? null : question.questionId)
                    : undefined
                }
                aria-expanded={hasDistribution ? isOpen : undefined}
              >
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
              {isOpen && hasDistribution ? (
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={3}>
                    <div
                      className="flex flex-col gap-1 py-1"
                      aria-label={`Answer distribution for question ${row.index + 1}`}
                    >
                      {question.distribution.map((bucket) => (
                        <div key={bucket.label} className="flex items-center gap-3 text-xs">
                          <span className="w-48 truncate" title={bucket.label}>
                            {bucket.label}
                          </span>
                          <div
                            className="h-2 rounded-full bg-primary/70"
                            style={{ width: `${Math.max(bucket.pct, 1.5)}%` }}
                            aria-hidden="true"
                          />
                          <span className="tabular-nums text-muted-foreground">
                            {formatInteger(bucket.count)} ({bucket.pct}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          )
        })}
      </TableBody>
    </Table>
  )
}
