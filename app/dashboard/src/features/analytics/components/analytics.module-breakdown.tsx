import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Button } from '#/components/ui/button'
import { EmptyState } from '#/components/common/empty-state'
import { formatPercent } from '#/lib/format'
import type { ModuleBreakdownRow } from '../analytics.types'

const features = tableFeatures({})

interface ModuleBreakdownTableProps {
  modules: ModuleBreakdownRow[]
  courseId: string
  /** S-5.1: "Unable to load analytics. Retry?" lives one level up. */
}

/**
 * S-5.1 Module Breakdown. Module rows drill down into S-5.2 Quiz Analytics:
 * a module with quiz lessons expands an inline list; a single-quiz module
 * navigates directly.
 */
export function ModuleBreakdownTable({ modules, courseId }: ModuleBreakdownTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const helper = createColumnHelper<typeof features, ModuleBreakdownRow>()

  const columns = helper.columns([
    helper.accessor('title', {
      id: 'title',
      header: 'Module',
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    helper.accessor('completionPct', {
      id: 'completionPct',
      header: 'Completion',
      cell: (info) => (
        <span className="tabular-nums">
          {info.getValue() == null ? '—' : formatPercent(info.getValue())}
        </span>
      ),
    }),
    helper.accessor('avgScorePct', {
      id: 'avgScorePct',
      header: 'Avg Score',
      cell: (info) => (
        <span className="tabular-nums">
          {info.getValue() == null ? '—' : formatPercent(info.getValue())}
        </span>
      ),
    }),
    helper.accessor('dropOffPts', {
      id: 'dropOffPts',
      header: 'Drop-off',
      cell: (info) => {
        const value = info.getValue()
        if (value == null) return <span className="tabular-nums">—</span>
        return (
          <span className={`tabular-nums ${value > 20 ? 'font-medium text-destructive' : ''}`}>
            {formatPercent(value)}
          </span>
        )
      },
    }),
    helper.display({
      id: 'drill',
      header: '',
      cell: ({ row }) => {
        const quizCount = row.original.quizzes.length
        if (quizCount === 0) return null
        if (quizCount === 1) {
          const quiz = row.original.quizzes[0]
          return (
            <Button
              variant="ghost"
              size="sm"
              render={
                <Link
                  to="/analytics/courses/$courseId/quizzes/$lessonId"
                  params={{ courseId, lessonId: quiz.lessonId }}
                >
                  Quiz Analytics
                </Link>
              }
            />
          )
        }
        return (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={expanded === row.original.moduleId}
            onClick={() =>
              setExpanded(expanded === row.original.moduleId ? null : row.original.moduleId)
            }
          >
            {quizCount} quizzes
          </Button>
        )
      },
    }),
  ])

  const table = useTable({ data: modules, columns, features })

  if (modules.length === 0) {
    return (
      <EmptyState
        variant="compact"
        title="No modules yet."
        description="Add modules and lessons to the course to see per-module performance."
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
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getAllCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
        {modules.map((module) =>
          expanded === module.moduleId && module.quizzes.length > 1 ? (
            <TableRow key={`${module.moduleId}-quizzes`} className="bg-muted/40 hover:bg-muted/40">
              <TableCell colSpan={5}>
                <div className="flex flex-wrap gap-2 py-1">
                  {module.quizzes.map((quiz) => (
                    <Button
                      key={quiz.lessonId}
                      variant="outline"
                      size="sm"
                      render={
                        <Link
                          to="/analytics/courses/$courseId/quizzes/$lessonId"
                          params={{ courseId, lessonId: quiz.lessonId }}
                        >
                          {quiz.title}
                        </Link>
                      }
                    />
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ) : null,
        )}
      </TableBody>
    </Table>
  )
}
