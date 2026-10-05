import { useMemo } from 'react'
import { createColumnHelper, flexRender, tableFeatures, useTable } from '@tanstack/react-table'
import { useRouter } from '@tanstack/react-router'
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
import { Skeleton } from '#/components/ui/skeleton'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon, ArrowUpDownIcon } from '@hugeicons/core-free-icons'
import { StatusPill } from '#/features/courses/components/courses.status-pill'
import { formatCurrency, formatInteger, formatPercent } from '#/lib/format'
import type {
  CoursePerformancePage,
  CoursePerformanceRow,
  CoursePerformanceSort,
} from '../dashboard.types'

type DashboardTableMeta = { align?: 'left' | 'right'; sortable?: boolean }

const dashboardTableMeta: DashboardTableMeta = {}

const features = tableFeatures({
  columnMeta: dashboardTableMeta,
})

interface CoursePerformanceTableProps {
  data: CoursePerformancePage
  onPageChange: (page: number) => void
  onSortChange?: (sort: CoursePerformanceSort) => void
  isFetching?: boolean
  /** Where a row opens (S-2.6 Course Workspace on the dashboard, S-5.1 elsewhere). */
  getRowHref?: (row: CoursePerformanceRow) => string
  /** Fired when a row is opened — the seam for `dashboard_course_opened`. */
  onRowOpen?: (row: CoursePerformanceRow) => void
  /** True when the caller has applied a filter that excluded every row. */
  isFiltered?: boolean
  onClearFilters?: () => void
}

/**
 * Loading placeholder (spec S-1.1): skeleton rows **under a mounted header**, so
 * the table's shape is stable while data arrives and the header stays legible.
 */
export function CoursePerformanceTableSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading course performance">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, index) => (
              <TableHead key={index}>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columns }).map((__, columnIndex) => (
                <TableCell key={columnIndex}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Course performance table (S-1.1): server-paginated and server-sorted via URL
 * search params, with the **state** column Revision 2 added — the dashboard has
 * to answer "what needs me", so a draft shows how many items still need content
 * and a course in review shows how many decisions are pending.
 *
 * Two states the spec separates and this table keeps separate:
 *
 * - **True empty** — the workspace has no courses. Offers the create path.
 * - **Zero-result** — courses exist, a filter or page excluded them. Offers
 *   _Clear filters_ and no creation CTA.
 */
export function CoursePerformanceTable({
  data,
  onPageChange,
  onSortChange,
  isFetching = false,
  getRowHref,
  onRowOpen,
  isFiltered = false,
  onClearFilters,
}: CoursePerformanceTableProps) {
  const router = useRouter()
  const helper = createColumnHelper<typeof features, CoursePerformanceRow>()

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('title', {
          id: 'title',
          header: 'Course Name',
          cell: (info) => {
            const href = getRowHref?.(info.row.original)
            if (!href) return <span className="font-medium">{info.getValue()}</span>
            return (
              <button
                type="button"
                className="rounded text-left font-medium underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() => {
                  onRowOpen?.(info.row.original)
                  void router.history.push(href)
                }}
              >
                {info.getValue()}
              </button>
            )
          },
        }),
        helper.accessor('state', {
          id: 'state',
          header: 'State',
          cell: (info) => (
            <span className="flex flex-col items-start gap-0.5">
              <StatusPill
                tone={info.getValue()}
                label={
                  info.getValue() === 'in_review'
                    ? 'In Review'
                    : info.getValue().charAt(0).toUpperCase() + info.getValue().slice(1)
                }
              />
              {info.row.original.stateNote ? (
                <span className="text-xs text-muted-foreground">{info.row.original.stateNote}</span>
              ) : null}
            </span>
          ),
        }),
        helper.accessor('students', {
          id: 'students',
          header: 'Students',
          cell: (info) => <span className="tabular-nums">{formatInteger(info.getValue())}</span>,
          meta: { sortable: true },
        }),
        helper.accessor('completionPct', {
          id: 'completionPct',
          header: 'Completion',
          cell: (info) => <span className="tabular-nums">{formatPercent(info.getValue())}</span>,
          meta: { sortable: true },
        }),
        // Money is absent for a role without `finance.view_revenue` — the
        // column is dropped, not blanked (spec S-1.1).
        ...(data.canViewRevenue
          ? [
              helper.accessor('revenue', {
                id: 'revenue',
                header: 'Revenue',
                cell: (info) => (
                  <span className="block text-right tabular-nums">
                    {formatCurrency(info.getValue())}
                  </span>
                ),
                meta: { align: 'right', sortable: true },
              }),
            ]
          : []),
      ]),
    [helper, getRowHref, onRowOpen, data.canViewRevenue, router],
  )

  const table = useTable<typeof features, CoursePerformanceRow>({
    features,
    data: data.rows,
    columns,
  })

  function alignClass(align?: 'left' | 'right') {
    return align === 'right' ? 'text-right' : undefined
  }

  if (data.totalRows === 0) {
    return isFiltered ? (
      <EmptyState
        variant="compact"
        level={3}
        title="No matches — adjust filters."
        description="Courses exist, but none of them match the current filters."
        action={
          onClearFilters ? (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null
        }
      />
    ) : (
      <EmptyState
        level={3}
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
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta
                const sortKey = header.column.id as CoursePerformanceSort
                const isSorted = onSortChange != null && data.sort === sortKey
                return (
                  <TableHead
                    key={header.id}
                    scope="col"
                    aria-sort={isSorted ? 'descending' : 'none'}
                    className={alignClass(meta?.align)}
                  >
                    {meta?.sortable && onSortChange ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => onSortChange(sortKey)}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        <HugeiconsIcon
                          icon={ArrowUpDownIcon}
                          size={12}
                          strokeWidth={2}
                          aria-hidden="true"
                          className={isSorted ? 'text-foreground' : 'text-muted-foreground'}
                        />
                        <span className="sr-only">
                          {isSorted ? 'sorted, descending' : 'activate to sort by this column'}
                        </span>
                      </button>
                    ) : header.isPlaceholder ? null : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
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
