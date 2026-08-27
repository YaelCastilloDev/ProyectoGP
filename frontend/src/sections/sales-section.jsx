import * as React from 'react'

import { DataTable } from '@/components/data-table'
import { SalesImportDialog } from '@/sections/sales-import-dialog'
import { ErrorState, LoadingRows } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useStore } from '@/context/store-context'
import { getErrorDetail, listProducts, listSales } from '@/lib/api'
import { formatDate, formatMoney } from '@/lib/format'
import { UploadIcon } from 'lucide-react'

const PAGE_SIZE = 100

export function SalesSection() {
  const { activeStore } = useStore()
  const [sales, setSales] = React.useState({ rows: [], total: 0, limit: PAGE_SIZE, offset: 0 })
  const [products, setProducts] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)
  const [importOpen, setImportOpen] = React.useState(false)

  const load = React.useCallback(
    async (offset = 0) => {
      if (!activeStore) return
      setLoading(true)
      setError(null)
      try {
        const data = await listSales(activeStore.id, { limit: PAGE_SIZE, offset })
        setSales(data)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    },
    [activeStore]
  )

  React.useEffect(() => {
    load(0)
  }, [load])

  React.useEffect(() => {
    listProducts().then(setProducts).catch(() => {})
  }, [])

  const columns = [
    {
      key: 'fecha',
      header: 'Fecha',
      render: (row) => <span className="text-muted-foreground">{formatDate(row.fecha)}</span>,
    },
    {
      key: 'ticket_id',
      header: 'Ticket',
      render: (row) => <span className="font-mono text-xs">{row.ticket_id}</span>,
    },
    {
      key: 'sku',
      header: 'SKU',
      render: (row) => <span className="font-mono text-xs">{row.sku}</span>,
    },
    { key: 'nombre', header: 'Producto' },
    {
      key: 'cantidad',
      header: 'Cantidad',
      className: 'text-right',
      render: (row) => <span className="tabular-nums">{row.cantidad}</span>,
    },
    {
      key: 'precio_unitario',
      header: 'Precio',
      className: 'text-right',
      render: (row) => <span className="tabular-nums">{formatMoney(row.precio_unitario)}</span>,
    },
    {
      key: 'subtotal',
      header: 'Subtotal',
      className: 'text-right',
      render: (row) => (
        <span className="font-medium tabular-nums">{formatMoney(row.subtotal)}</span>
      ),
    },
  ]

  if (!activeStore) {
    return (
      <div className="p-4 lg:p-6">
        <ErrorState message="Selecciona o crea una tienda para ver su historial de ventas" />
      </div>
    )
  }

  const canPrev = sales.offset > 0
  const canNext = sales.offset + sales.rows.length < sales.total

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Ventas · {activeStore.nombre}</h2>
          <p className="text-sm text-muted-foreground">
            {sales.total} líneas de venta registradas
          </p>
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <UploadIcon data-icon="inline-start" />
          Importar historial
        </Button>
      </div>

      {loading ? (
        <LoadingRows rows={6} cols={6} />
      ) : error ? (
        <ErrorState message={getErrorDetail(error)} onRetry={() => load(sales.offset)} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={sales.rows}
            getRowId={(row, index) => `${row.ticket_id}-${row.sku}-${index}`}
            emptyMessage="Esta tienda no tiene ventas registradas (caso de arranque en frío)"
          />
          {sales.total > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={!canPrev}
                onClick={() => load(sales.offset - PAGE_SIZE)}>
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                {sales.offset + 1}–{Math.min(sales.offset + PAGE_SIZE, sales.total)} de{' '}
                {sales.total}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!canNext}
                onClick={() => load(sales.offset + PAGE_SIZE)}>
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}

      <SalesImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        storeId={activeStore.id}
        products={products}
        onImported={() => load(0)}
      />
    </div>
  )
}
