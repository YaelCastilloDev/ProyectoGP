import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/states'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from 'lucide-react'

export function DataTable({
  columns,
  data = [],
  getRowId = (row, index) => row?.id ?? row?.sku ?? index,
  emptyMessage = 'No hay datos para mostrar',
  pageSizeOptions = [10, 25, 50],
}) {
  const [pageIndex, setPageIndex] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(pageSizeOptions[0])

  React.useEffect(() => {
    setPageIndex(0)
  }, [data, pageSize])

  const pageCount = Math.max(1, Math.ceil(data.length / pageSize))
  const safePage = Math.min(pageIndex, pageCount - 1)
  const pageRows = data.slice(safePage * pageSize, (safePage + 1) * pageSize)

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key} className={column.className}>
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length ? (
                pageRows.map((row, index) => (
                  <TableRow key={getRowId(row, index)}>
                    {columns.map((column) => (
                      <TableCell key={column.key} className={column.className}>
                        {column.render ? column.render(row) : row[column.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 p-0">
                    <div className="m-4">
                      <EmptyState message={emptyMessage} />
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex items-center justify-between px-4">
        <div className="hidden flex-1 text-sm text-muted-foreground sm:flex">
          {data.length} registro{data.length === 1 ? '' : 's'}
        </div>
        <div className="flex w-full items-center justify-end gap-4 sm:w-fit">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filas</span>
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger size="sm" className="w-18">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm font-medium">
            Página {safePage + 1} de {pageCount}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="hidden size-8 sm:flex"
              size="icon"
              onClick={() => setPageIndex(0)}
              disabled={safePage === 0}>
              <span className="sr-only">Primera página</span>
              <ChevronsLeftIcon />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => setPageIndex(safePage - 1)}
              disabled={safePage === 0}>
              <span className="sr-only">Anterior</span>
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => setPageIndex(safePage + 1)}
              disabled={safePage >= pageCount - 1}>
              <span className="sr-only">Siguiente</span>
              <ChevronRightIcon />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 sm:flex"
              size="icon"
              onClick={() => setPageIndex(pageCount - 1)}
              disabled={safePage >= pageCount - 1}>
              <span className="sr-only">Última página</span>
              <ChevronsRightIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
