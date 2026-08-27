import * as React from 'react'

import { ExplainDialog } from '@/sections/explain-dialog'
import { EmptyState, ErrorState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { useStore } from '@/context/store-context'
import { getErrorDetail, getRecommendations } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { FlaskConicalIcon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'

function SignalBar({ label, value, max }) {
  const width = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
      <span className="w-12 text-right tabular-nums text-muted-foreground">
        {value.toFixed(2)}
      </span>
    </div>
  )
}

export function RecommendationsSection() {
  const { stores, activeStoreId, setActiveStoreId } = useStore()
  const [cart, setCart] = React.useState('')
  const [limit, setLimit] = React.useState('5')
  const [result, setResult] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [explain, setExplain] = React.useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (activeStoreId == null) {
      toast.error('Selecciona una tienda')
      return
    }
    if (!cart.trim()) {
      toast.error('Escribe al menos un SKU en el carrito')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await getRecommendations({
        store_id: activeStoreId,
        cart: cart.trim(),
        limit: Number(limit),
      })
      setResult(data)
    } catch (err) {
      setError(err)
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  const maxSignal = React.useMemo(() => {
    if (!result?.items?.length) return 0
    return Math.max(
      ...result.items.flatMap((item) => [item.content, item.cooccurrence, item.popularity])
    )
  }, [result])

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div>
        <h2 className="text-lg font-semibold">Recomendaciones</h2>
        <p className="text-sm text-muted-foreground">
          Sugerencias híbridas explicables a partir de un carrito de SKUs
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4" />
            Generar recomendaciones
          </CardTitle>
          <CardDescription>Los SKUs van separados por coma, p. ej. SKU001, SKU004</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.2fr_0.5fr_auto]">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rec-store">Tienda</Label>
                <Select
                  value={activeStoreId == null ? undefined : String(activeStoreId)}
                  onValueChange={(value) => setActiveStoreId(Number(value))}>
                  <SelectTrigger id="rec-store" className="w-full">
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
                <Label htmlFor="rec-limit">Cantidad (top-K)</Label>
                <Select value={limit} onValueChange={setLimit}>
                  <SelectTrigger id="rec-limit" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={busy}>
                  {busy ? 'Calculando…' : 'Recomendar'}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rec-cart">Carrito (SKUs)</Label>
              <Input
                id="rec-cart"
                value={cart}
                onChange={(e) => setCart(e.target.value)}
                placeholder="SKU001, SKU004"
              />
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <ErrorState message={getErrorDetail(error)} onRetry={() => setError(null)} />
      )}

      {result && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {result.items.length} sugerencia{result.items.length === 1 ? '' : 's'} para{' '}
              <span className="font-mono text-foreground">{result.seeds.join(', ')}</span>
            </span>
            <Badge variant="outline">
              cooc {result.weights_used.w_cooccurrence} · contenido{' '}
              {result.weights_used.w_content} · popularidad {result.weights_used.w_popularity}
            </Badge>
          </div>

          {result.items.length === 0 ? (
            <EmptyState message="Sin sugerencias para este carrito (¿se bloquearon los candidatos o no hay stock?)" />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.items.map((item, index) => (
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
                      <SignalBar label="Contenido" value={item.content} max={maxSignal} />
                      <SignalBar
                        label="Co-ocurrencia"
                        value={item.cooccurrence}
                        max={maxSignal}
                      />
                      <SignalBar label="Popularidad" value={item.popularity} max={maxSignal} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Score</span>
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
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExplain({ source: result.seeds[0], target: item.sku })}>
                        <FlaskConicalIcon data-icon="inline-start" />
                        Explicar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

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
