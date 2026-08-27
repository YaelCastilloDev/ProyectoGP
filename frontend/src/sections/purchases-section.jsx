import * as React from 'react'

import { ErrorState, LoadingRows } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useStore } from '@/context/store-context'
import { createPurchase, getErrorDetail, listProducts } from '@/lib/api'
import { formatDate, formatMoney } from '@/lib/format'
import { PlusIcon, ShoppingCartIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

function emptyLine() {
  return { sku: '', cantidad: '1' }
}

export function PurchasesSection() {
  const { stores, activeStoreId, setActiveStoreId } = useStore()
  const [products, setProducts] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)
  const [lines, setLines] = React.useState([emptyLine()])
  const [busy, setBusy] = React.useState(false)
  const [receipt, setReceipt] = React.useState(null)

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

  function updateLine(index, field) {
    return (value) => {
      setLines((current) =>
        current.map((line, i) => (i === index ? { ...line, [field]: value } : line))
      )
    }
  }

  const catalog = React.useMemo(
    () => new Map(products.map((product) => [product.sku, product])),
    [products]
  )

  const total = lines.reduce((sum, line) => {
    const product = catalog.get(line.sku)
    return product ? sum + product.precio * (Number(line.cantidad) || 0) : sum
  }, 0)

  async function handleSubmit(e) {
    e.preventDefault()
    const items = lines
      .map((line) => ({ sku: line.sku, cantidad: Number(line.cantidad) || 0 }))
      .filter((line) => line.sku && line.cantidad > 0)
    if (items.length === 0) {
      toast.error('Agrega al menos un producto al ticket')
      return
    }
    if (activeStoreId == null) {
      toast.error('Selecciona una tienda')
      return
    }
    setBusy(true)
    try {
      const result = await createPurchase(activeStoreId, items)
      setReceipt(result)
      setLines([emptyLine()])
      toast.success(`Compra registrada: ${result.ticket_id}`)
      load()
    } catch (err) {
      toast.error(getErrorDetail(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6">
        <LoadingRows rows={4} cols={4} />
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

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div>
        <h2 className="text-lg font-semibold">Nueva compra</h2>
        <p className="text-sm text-muted-foreground">
          Vende desde el inventario compartido. Si una línea supera el stock, todo el ticket se
          rechaza.
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCartIcon className="size-4" />
            Ticket
          </CardTitle>
          <CardDescription>Selecciona la tienda y agrega productos</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:max-w-xs">
              <Label htmlFor="purchase-store">Tienda</Label>
              <Select
                value={activeStoreId == null ? undefined : String(activeStoreId)}
                onValueChange={(value) => setActiveStoreId(Number(value))}>
                <SelectTrigger id="purchase-store" className="w-full">
                  <SelectValue placeholder="Elegir tienda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={String(store.id)}>
                        {store.nombre}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <div className="hidden grid-cols-[1.5fr_0.6fr_1fr_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
                <span>Producto</span>
                <span>Cantidad</span>
                <span className="text-right">Subtotal</span>
                <span />
              </div>
              {lines.map((line, index) => {
                const product = catalog.get(line.sku)
                const subtotal = product ? product.precio * (Number(line.cantidad) || 0) : 0
                return (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1.5fr_0.6fr_1fr_2rem]">
                    <Select value={line.sku} onValueChange={updateLine(index, 'sku')}>
                      <SelectTrigger className="w-full" aria-label="Producto">
                        <SelectValue placeholder="Selecciona un producto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {products.map((product) => (
                            <SelectItem
                              key={product.sku}
                              value={product.sku}
                              disabled={product.stock === 0}>
                              {product.sku} · {product.nombre}
                              {product.stock === 0 ? ' (agotado)' : ''}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      value={line.cantidad}
                      onChange={(e) => updateLine(index, 'cantidad')(e.target.value)}
                      aria-label="Cantidad"
                    />
                    <div className="flex items-center justify-between sm:justify-end">
                      <span className="text-sm font-medium tabular-nums sm:text-right">
                        {formatMoney(subtotal)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines((current) => current.filter((_, i) => i !== index))
                        }
                        aria-label="Quitar línea">
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => setLines((current) => [...current, emptyLine()])}>
                <PlusIcon data-icon="inline-start" />
                Agregar producto
              </Button>
            </div>

            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-lg font-semibold tabular-nums">{formatMoney(total)}</span>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? 'Registrando…' : 'Registrar compra'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={receipt != null} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Compra registrada</DialogTitle>
            <DialogDescription>
              Ticket {receipt?.ticket_id} · {formatDate(receipt?.fecha)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {receipt?.items.map((item) => (
              <div key={item.sku} className="flex items-center justify-between text-sm">
                <span>
                  {item.cantidad} × {item.nombre}
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{item.sku}</span>
                </span>
                <span className="tabular-nums">{formatMoney(item.subtotal)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(receipt?.total)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setReceipt(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
