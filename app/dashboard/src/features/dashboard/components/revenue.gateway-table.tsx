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
import { formatCompactCurrency, formatInteger } from '#/lib/format'
import type { RevenueByGatewayRow } from '../dashboard.types'

type DashboardTableMeta = { align?: 'left' | 'right' }

const dashboardTableMeta: DashboardTableMeta = {}

const features = tableFeatures({
  columnMeta: dashboardTableMeta,
})

/**
 * Payment gateway breakdown table (S-1.2). Small client-side dataset —
 * TanStack Table drives columns/headers; no pagination required.
 */
export function RevenueGatewayTable({ rows }: { rows: RevenueByGatewayRow[] }) {
  const helper = createColumnHelper<typeof features, RevenueByGatewayRow>()

  const columns = useMemo(
    () =>
      createColumnHelper<typeof features, RevenueByGatewayRow>().columns([
        helper.accessor('displayName', {
          id: 'gateway',
          header: 'Payment Gateway',
          cell: (info) => <span className="font-medium">{info.getValue()}</span>,
        }),
        helper.accessor('transactions', {
          id: 'transactions',
          header: 'Transactions',
          cell: (info) => <span className="tabular-nums">{formatInteger(info.getValue())}</span>,
        }),
        helper.accessor('amount', {
          id: 'amount',
          header: 'Amount',
          cell: (info) => (
            <span className="block text-right tabular-nums">
              {formatCompactCurrency(info.getValue())}
            </span>
          ),
          meta: { align: 'right' },
        }),
      ]),
    [helper],
  )

  const table = useTable<typeof features, RevenueByGatewayRow>({
    features,
    data: rows,
    columns,
  })

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No transactions recorded for the selected period.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={
                  header.column.columnDef.meta?.align === 'right' ? 'text-right' : undefined
                }
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
          <TableRow key={row.id}>
            {row.getAllCells().map((cell) => (
              <TableCell
                key={cell.id}
                className={cell.column.columnDef.meta?.align === 'right' ? 'text-right' : undefined}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
