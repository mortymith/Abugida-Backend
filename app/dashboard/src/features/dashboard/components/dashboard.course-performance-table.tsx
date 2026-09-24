import { useMemo } from 'react'
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
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { formatCurrency, formatInteger, formatPercent } from '#/lib/format'
import type { CoursePerformancePage } from '../dashboard.types'

type DashboardTableMeta = { align?: 'left' | 'right' }

const dashboardTableMeta: DashboardTableMeta = {}

const features = tableFeatures({
  columnMeta: dashboardTableMeta,
})

interface CoursePerformanceTableProps {
  data: CoursePerformancePage
  onPageChange: (page: number) => void
  isFetching?: boolean
  onRowClick?: (row: CoursePerformancePage['rows'][number]) => void
}

/**
 * Course performance table (S-1.1): server-paginated via URL search params.
 * TanStack Table v9 provides the headless column model; pagination stays
 * server-side (`manualPagination` equivalent — one page of rows is passed in).
 */
export function CoursePerformanceTable({
  data,
  onPageChange,
  isFetching = false,
  onRowClick,
}: CoursePerformanceTableProps) {
  const helper = createColumnHelper<typeof features, CoursePerformancePage['rows'][number]>()

  const columns = useMemo(
    () =>
      createColumnHelper<typeof features, CoursePerformancePage['rows'][number]>().columns([
        helper.accessor('title', {
          id: 'title',
          header: 'Course Name',
          cell: (info) => <span className="font-medium">{info.getValue()}</span>,
        }),
        helper.accessor('students', {
          id: 'students',
          header: 'Students',
          cell: (info) => <span className="tabular-nums">{formatInteger(info.getValue())}</span>,
        }),
        helper.accessor('completionPct', {
          id: 'completionPct',
          header: 'Completion',
          cell: (info) => <span className="tabular-nums">{formatPercent(info.getValue())}</span>,
        }),
        helper.accessor('revenue', {
          id: 'revenue',
          header: 'Revenue',
          cell: (info) => (
            <span className="block text-right tabular-nums">{formatCurrency(info.getValue())}</span>
          ),
          meta: { align: 'right' },
        }),
      ]),
    [helper],
  )

  const table = useTable<typeof features, CoursePerformancePage['rows'][number]>({
    features,
    data: data.rows,
    columns,
  })

  function alignClass(align?: 'left' | 'right') {
    return align === 'right' ? 'text-right' : undefined
  }

  if (data.totalRows === 0) {
    return (
      <EmptyState
        title="No courses yet."
        description="Published courses with enrollments will appear here."
      />
    )
  }

  const totalPages = Math.max(1, Math.ceil(data.totalRows / data.pageSize))
  const canPreviousPage = data.page > 1
  const canNextPage = data.hasNextPage

  return (
    <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={alignClass(header.column.columnDef.meta?.align)}
                >
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
            <TableRow
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
              className={onRowClick ? 'cursor-pointer' : undefined}
            >
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className={alignClass(cell.column.columnDef.meta?.align)}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between gap-2 pt-3">
        <p className="text-xs text-muted-foreground tabular-nums">
          Page {data.page} of {totalPages} · {formatInteger(data.totalRows)} courses
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous page"
            disabled={!canPreviousPage}
            onClick={() => onPageChange(data.page - 1)}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={2} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next page"
            disabled={!canNextPage}
            onClick={() => onPageChange(data.page + 1)}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2} />
          </Button>
        </div>
      </div>
    </div>
  )
}
