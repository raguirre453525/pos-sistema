"use client"
import * as React from "react"
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  FilterFn
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Input } from "@/components/ui/input"
import { DataTablePagination } from "./DataTablePagination"

const accentInsensitiveFilter: FilterFn<any> = (row, columnId, filterValue) => {
  const normalize = (str: string) =>
    str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const cellValue = normalize(String(row.getValue(columnId) ?? ""));
  const search = normalize(filterValue);
  return cellValue.includes(search);
};

interface DataTableProps<TData, Tvalue> {
    columns: ColumnDef<TData, Tvalue>[]
    data: TData[]
    placeholder?: string
    label: string
    onRowClick?: (row: TData) => void
    hideSearch?: boolean
    hidePagination?: boolean
}

export function DataTable<TData, TValue>({
    columns,
    data,
    placeholder = "Buscar...",
    label,
    onRowClick,
    hideSearch = false,
    hidePagination = false,
}: DataTableProps<TData, TValue>) {
    
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [globalFilter, setGlobalFilter] = React.useState("")
    const [pagination, setPagination] = React.useState({
        pageIndex: 0,
        pageSize: hidePagination ? 1000 : 5,
    })

    React.useEffect(() => {
        if (hidePagination) {
            setPagination((prev) => {
                const desired = Math.max(data.length, 1000)
                return prev.pageSize === desired ? prev : { ...prev, pageSize: desired }
            })
        }
    }, [hidePagination, data.length])

    const table = useReactTable({
        data,
        columns,
        globalFilterFn: accentInsensitiveFilter,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        state: {
            sorting,
            globalFilter,
            pagination,
        },
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    })
    return (
        <div>
            {!hideSearch && (
              <div className="flex items-center py-4">
                <Input
                  placeholder={placeholder}
                  value={globalFilter ?? ""}
                  onChange={(event) => setGlobalFilter(event.target.value)}
                  className="max-w-sm"
                />
              </div>
            )}
            <div className="overflow-hidden rounded-md border"> 
        <Table className="table-fixed">
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <TableHead key={header.id}>
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow
                                key={row.id}
                                onClick={() => onRowClick?.(row.original as TData)}
                                className={onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined}
                            >
                        {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                        ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                Sin resultados.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table> 
        </div>
        {!hidePagination && <DataTablePagination table={table} label={label} />}
    </div>
        
    )
}

export default DataTable
