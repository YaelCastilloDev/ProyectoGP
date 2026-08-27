import * as React from 'react'

import { DataTable } from '@/components/data-table'
import { SalesChart } from '@/components/sales-chart'
import { SectionCards } from '@/components/section-cards'
import { ErrorState, LoadingRows } from '@/components/states'
import { useStore } from '@/context/store-context'
import { getErrorDetail, listProducts, listRules, listSales } from '@/lib/api'
import { formatMoney, formatNumber } from '@/lib/format'

export function DashboardSection() {
  const { activeStore } = useStore()
  const [products, setProducts] = React.useState([])
  const [rules, setRules] = React.useState([])
  const [sales, setSales] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [productsData, rulesData] = await Promise.all([listProducts(), listRules()])
      setProducts(productsData)
      setRules(rulesData)
      if (activeStore) {
        const salesData = await listSales(activeStore.id, { limit: 500, offset: 0 })
        setSales(salesData.rows)
      } else {
        setSales([])
      }
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [activeStore])

  React.useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="p-4 lg:p-6">
        <LoadingRows rows={6} cols={4} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 lg:p-6">
        <ErrorState message={getErrorDetail(error)} onRetry={load} />
      </div>
    )
  }

  const totalStock = products.reduce((sum, product) => sum + product.stock, 0)
  const totalSales = sales.reduce((sum, row) => sum + row.subtotal, 0)
  const totalUnits = sales.reduce((sum, row) => sum + row.cantidad, 0)

  const cards = [
    {
      title: 'Productos',
      value: formatNumber(products.length),
      badge: `${formatNumber(totalStock)} en stock`,
      description: 'Catálogo compartido entre tiendas',
    },
    {
      title: 'Ventas registradas',
      value: formatNumber(sales.length),
      badge: formatMoney(totalSales),
      description: activeStore ? `Líneas de ${activeStore.nombre}` : 'Sin tienda seleccionada',
    },
    {
      title: 'Unidades vendidas',
      value: formatNumber(totalUnits),
      badge: activeStore?.nombre ?? '—',
      description: 'Suma de cantidades en el historial',
    },
    {
      title: 'Reglas activas',
      value: formatNumber(rules.length),
      badge: `${rules.filter((rule) => rule.action === 'block').length} bloqueos`,
      description: 'Ajustes del negocio sobre el recomendador',
    },
  ]

  const columns = [
    {
      key: 'fecha',
      header: 'Fecha',
      render: (row) => (
        <span className="text-muted-foreground">
          {new Date(`${row.fecha}T00:00:00`).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
          })}
        </span>
      ),
    },
    {
      key: 'ticket_id',
      header: 'Ticket',
      render: (row) => <span className="font-mono text-xs">{row.ticket_id}</span>,
    },
    { key: 'nombre', header: 'Producto' },
    {
      key: 'cantidad',
      header: 'Cantidad',
      className: 'text-right',
      render: (row) => <span className="tabular-nums">{row.cantidad}</span>,
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

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards cards={cards} />
      <div className="px-4 lg:px-6">
        <SalesChart rows={sales} />
      </div>
      <div className="px-4 lg:px-6">
        <div className="mb-3">
          <h2 className="text-base font-medium">Ventas recientes</h2>
          <p className="text-sm text-muted-foreground">
            Últimas líneas de {activeStore?.nombre ?? 'la tienda activa'}
          </p>
        </div>
        <DataTable
          columns={columns}
          data={[...sales].reverse().slice(0, 50)}
          getRowId={(row, index) => `${row.ticket_id}-${row.sku}-${index}`}
          emptyMessage="No hay ventas registradas para esta tienda"
          pageSizeOptions={[10, 25, 50]}
        />
      </div>
    </div>
  )
}
