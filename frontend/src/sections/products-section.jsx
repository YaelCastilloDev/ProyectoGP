import * as React from 'react'

import { DataTable } from '@/components/data-table'
import { ProductFormDialog } from '@/sections/product-form-dialog'
import { ErrorState, LoadingRows } from '@/components/states'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteProduct, getErrorDetail, listProducts } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

export function ProductsSection() {
  const [products, setProducts] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)
  const [search, setSearch] = React.useState('')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState(null)
  const [deleting, setDeleting] = React.useState(null)
  const [deleteBusy, setDeleteBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProducts(await listProducts())
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(product) {
    setEditing(product)
    setDialogOpen(true)
  }

  async function handleDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await deleteProduct(deleting.sku)
      toast.success(`Producto eliminado: ${deleting.nombre}`)
      setDeleting(null)
      load()
    } catch (err) {
      toast.error(getErrorDetail(err))
    } finally {
      setDeleteBusy(false)
    }
  }

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return products
    return products.filter(
      (product) =>
        product.sku.toLowerCase().includes(query) ||
        product.nombre.toLowerCase().includes(query) ||
        product.categoria.toLowerCase().includes(query)
    )
  }, [products, search])

  const columns = [
    {
      key: 'sku',
      header: 'SKU',
      render: (product) => <span className="font-mono text-xs">{product.sku}</span>,
    },
    {
      key: 'nombre',
      header: 'Nombre',
      render: (product) => (
        <div className="flex flex-col">
          <span className="font-medium">{product.nombre}</span>
          {product.descripcion && (
            <span className="max-w-72 truncate text-xs text-muted-foreground">
              {product.descripcion}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'categoria',
      header: 'Categoría',
      render: (product) => <Badge variant="outline">{product.categoria}</Badge>,
    },
    {
      key: 'material',
      header: 'Material',
      render: (product) => (
        <span className="text-muted-foreground">{product.material || '—'}</span>
      ),
    },
    {
      key: 'precio',
      header: 'Precio',
      className: 'text-right',
      render: (product) => (
        <span className="font-medium tabular-nums">{formatMoney(product.precio)}</span>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      className: 'text-right',
      render: (product) => (
        <Badge variant={product.stock === 0 ? 'destructive' : 'secondary'} className="tabular-nums">
          {product.stock === 0 ? 'Agotado' : product.stock}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      render: (product) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => openEdit(product)}
            aria-label={`Editar ${product.nombre}`}>
            <PencilIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            onClick={() => setDeleting(product)}
            aria-label={`Eliminar ${product.nombre}`}>
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Catálogo de productos</h2>
          <p className="text-sm text-muted-foreground">
            {products.length} productos · inventario compartido entre tiendas
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon data-icon="inline-start" />
          Nuevo producto
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por SKU, nombre o categoría…"
            className="pl-8"
          />
        </div>
      </div>

      {loading ? (
        <LoadingRows rows={6} cols={6} />
      ) : error ? (
        <ErrorState
          message={getErrorDetail(error)}
          onRetry={load}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage={
            search ? 'Sin resultados para la búsqueda' : 'No hay productos. Crea el primero.'
          }
        />
      )}

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
        onSaved={load}
      />

      <AlertDialog open={deleting != null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {deleting?.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará {deleting?.sku} del catálogo. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteBusy}>
              {deleteBusy ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
