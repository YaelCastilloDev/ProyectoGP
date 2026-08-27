import * as React from 'react'

import { ExplainDialog } from '@/sections/explain-dialog'
import { EmptyState, ErrorState, LoadingRows } from '@/components/states'
import { Badge } from '@/components/ui/badge'
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
import { createPurchase, getErrorDetail, getRecommendations, listProducts } from '@/lib/api'
import { formatDate, formatMoney } from '@/lib/format'
import { FlaskConicalIcon, PlusIcon, ShoppingCartIcon, SparklesIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

function emptyLine() {
  return { sku: '', cantidad: '1' }
}

function SignalBar({ label, value, max }) {
  const width = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
      <span className="w-12 text-right tabular-nums text-muted-foreground">
        {value.toFixed(2)}
      </span>
    </div>
  )
}

export function PurchasesSection() {
  const { stores, activeStoreId, setActiveStoreId } = useStore()
  const [products, setProducts] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)
  const [lines, setLines] = React.useState([emptyLine()])
  const [busy, setBusy] = React.useState(false)
  const [receipt, setReceipt] = React.useState(null)
  const [recs, setRecs] = React.useState(null)
  const [recsBusy, setRecsBusy] = React.useState(false)
  const [recsError, setRecsError] = React.useState(null)
  const [explain, setExplain] = React.useState(null)

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

  const catalog = React.useMemo(
    () => new Map(products.map((product) => [product.sku, product])),
    [products]
  )

  const cartSkus = React.useMemo(
    () => [...new Set(lines.map((line) => line.sku).filter(Boolean))],
    [lines]
  )
  const cartKey = cartSkus.join(',')

  React.useEffect(() => {
    if (cartKey === '' || activeStoreId == null) {
      setRecs(null)
      setRecsError(null)
      return
    }
    let cancelled = false
    setRecsBusy(true)
    setRecsError(null)
    getRecommendations({ store_id: activeStoreId, cart: cartKey, limit: 5 })
      .then((data) => {
        if (!cancelled) setRecs(data)
      })
      .catch((err) => {
        if (!cancelled) {
          setRecs(null)
          setRecsError(err)
        }
      })
      .finally(() => {
        if (!cancelled) setRecsBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [cartKey, activeStoreId])

  function updateLine(index, field) {
    return (value) => {
      setLines((current) =>
        current.map((line, i) => (i === index ? { ...line, [field]: value } : line))
      )
    }
  }

  function addProductLine(sku) {
    setLines((current) => {
      const emptyIndex = current.findIndex((line) => !line.sku)
      if (emptyIndex !== -1) {
        return current.map((line, i) =>
          i === emptyIndex ? { ...line, sku, cantidad: '1' } : line
        )
      }
      return [...current, { sku, cantidad: '1' }]
    })
    toast.success('Producto agregado al ticket')
  }

  const total = lines.reduce((sum, line) => {
    const product = catalog.get(line.sku)
    return product ? sum + product.precio * (Number(line.cantidad) || 0) : sum
  }, 0)

  const maxSignal = React.useMemo(() => {
    if (!recs?.items?.length) return 0
    return Math.max(...recs.items.flatMap((item) => [item.content, item.cooccurrence, item.popularity]))
  }, [recs])

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
          rechaza. Al elegir productos, abajo verás sugerencias para ofrecer al cliente.
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

      {cartSkus.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <SparklesIcon className="size-4" />
              Sugerencias para este carrito
            </h3>
            {recs && (
              <span className="text-sm text-muted-foreground">
                {recs.items.length} sugerencia{recs.items.length === 1 ? '' : 's'} para{' '}
                <span className="font-mono text-foreground">{recs.seeds.join(', ')}</span>
              </span>
            )}
          </div>

          {recsBusy ? (
            <LoadingRows rows={2} cols={3} />
          ) : recsError ? (
            <ErrorState
              message={`No se pudieron cargar las sugerencias: ${getErrorDetail(recsError)}`}
              onRetry={() => {
                setRecsBusy(true)
                setRecsError(null)
                getRecommendations({ store_id: activeStoreId, cart: cartKey, limit: 5 })
                  .then(setRecs)
                  .catch(setRecsError)
                  .finally(() => setRecsBusy(false))
              }}
            />
          ) : recs ? (
            recs.items.length === 0 ? (
              <EmptyState message="Sin sugerencias para este carrito (¿se bloquearon los candidatos o no hay stock?)" />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {recs.items.map((item, index) => (
                  <Card key={item.sku}>
                    <CardHeader>
                      <CardDescription>
                        #{index + 1} · {item.sku}
                      </CardDescription>
                      <CardTitle>{item.nombre}</CardTitle>
                      <Badge
                        variant={item.stock === 0 ? 'destructive' : 'secondary'}
                        className="w-fit">
                        {item.stock === 0 ? 'Agotado' : `${item.stock} en stock`}
                      </Badge>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Precio</span>
                        <span className="font-medium tabular-nums">{formatMoney(item.precio)}</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <SignalBar
                          label="Atributos similares"
                          value={item.content}
                          max={maxSignal}
                        />
                        <SignalBar
                          label="Comprados juntos"
                          value={item.cooccurrence}
                          max={maxSignal}
                        />
                        <SignalBar
                          label="Más vendidos"
                          value={item.popularity}
                          max={maxSignal}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Puntaje</span>
                        <span className="font-semibold tabular-nums">{item.score.toFixed(2)}</span>
                      </div>
                      {item.rule_boost !== 1 && (
                        <Badge variant="outline" className="w-fit">
                          Regla aplicada ×{item.rule_boost}
                        </Badge>
                      )}
                      {item.reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.reasons.map((reason) => (
                            <Badge key={reason} variant="outline" className="text-xs">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExplain({ source: recs.seeds[0], target: item.sku })}>
                          <FlaskConicalIcon data-icon="inline-start" />
                          Explicar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => addProductLine(item.sku)}>
                          <PlusIcon data-icon="inline-start" />
                          Agregar al ticket
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          ) : null}
        </div>
      )}

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

      <ExplainDialog
        open={explain != null}
        onOpenChange={(open) => !open && setExplain(null)}
        storeId={activeStoreId}
        source={explain?.source}
        target={explain?.target}
      />
    </div>
  )
}
