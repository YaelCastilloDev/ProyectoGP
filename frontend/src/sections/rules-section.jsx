import * as React from 'react'

import { DataTable } from '@/components/data-table'
import { RuleFormDialog } from '@/sections/rule-form-dialog'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useStore } from '@/context/store-context'
import {
  deleteRule,
  getDiscoveredPairs,
  getErrorDetail,
  getWeights,
  listProducts,
  listRules,
  setWeights as saveWeights,
} from '@/lib/api'
import { PlusIcon, SparklesIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

export function RulesSection() {
  const { stores, activeStore } = useStore()
  const [rules, setRules] = React.useState([])
  const [products, setProducts] = React.useState([])
  const [pairs, setPairs] = React.useState({ cooccurrence: [], content: [] })
  const [weights, setWeights] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)
  const [pairsLoading, setPairsLoading] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [prefill, setPrefill] = React.useState(null)
  const [deleting, setDeleting] = React.useState(null)
  const [deleteBusy, setDeleteBusy] = React.useState(false)
  const [savingWeights, setSavingWeights] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rulesData, productsData] = await Promise.all([listRules(), listProducts()])
      setRules(rulesData)
      setProducts(productsData)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    if (!activeStore) return
    setPairsLoading(true)
    getDiscoveredPairs({ store_id: activeStore.id, limit: 10 })
      .then(setPairs)
      .catch(() => setPairs({ cooccurrence: [], content: [] }))
      .finally(() => setPairsLoading(false))
    getWeights(activeStore.id)
      .then((data) =>
        setWeights({
          w_cooccurrence: String(data.w_cooccurrence),
          w_content: String(data.w_content),
          w_popularity: String(data.w_popularity),
        })
      )
      .catch(() => setWeights(null))
  }, [activeStore])

  const storeNames = React.useMemo(
    () => new Map(stores.map((store) => [store.id, store.nombre])),
    [stores]
  )
  const productNames = React.useMemo(
    () => new Map(products.map((product) => [product.sku, product.nombre])),
    [products]
  )

  function openCreate() {
    setPrefill(null)
    setDialogOpen(true)
  }

  function openPrefilled(pair) {
    setPrefill({
      source_sku: pair.source_sku,
      target_sku: pair.target_sku,
      action: 'boost',
      note: '',
    })
    setDialogOpen(true)
  }

  async function handleDelete() {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await deleteRule(deleting.id)
      toast.success('Regla eliminada')
      setDeleting(null)
      load()
    } catch (err) {
      toast.error(getErrorDetail(err))
    } finally {
      setDeleteBusy(false)
    }
  }

  async function handleSaveWeights(e) {
    e.preventDefault()
    if (!activeStore || !weights) return
    setSavingWeights(true)
    try {
      const payload = {
        w_cooccurrence: Number(weights.w_cooccurrence) || 0,
        w_content: Number(weights.w_content) || 0,
        w_popularity: Number(weights.w_popularity) || 0,
      }
      await saveWeights(activeStore.id, payload)
      toast.success('Pesos del blend actualizados')
    } catch (err) {
      toast.error(getErrorDetail(err))
    } finally {
      setSavingWeights(false)
    }
  }

  const ruleColumns = [
    {
      key: 'target',
      header: 'Producto objetivo',
      render: (rule) => (
        <div className="flex flex-col">
          <span className="font-medium">{rule.target_nombre}</span>
          <span className="font-mono text-xs text-muted-foreground">{rule.target_sku}</span>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Origen',
      render: (rule) =>
        rule.source_sku ? (
          <div className="flex flex-col">
            <span>{productNames.get(rule.source_sku) ?? rule.source_sku}</span>
            <span className="font-mono text-xs text-muted-foreground">{rule.source_sku}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">Cualquier producto</span>
        ),
    },
    {
      key: 'store',
      header: 'Tienda',
      render: (rule) =>
        rule.store_id ? (
          storeNames.get(rule.store_id) ?? rule.store_id
        ) : (
          <Badge variant="outline">Todas</Badge>
        ),
    },
    {
      key: 'action',
      header: 'Acción',
      render: (rule) => (
        <Badge variant={rule.action === 'block' ? 'destructive' : 'default'}>
          {rule.action === 'block' ? 'bloquear' : 'impulsar'}
        </Badge>
      ),
    },
    {
      key: 'weight',
      header: 'Peso',
      className: 'text-right',
      render: (rule) => (
        <span className="tabular-nums">{rule.action === 'boost' ? rule.weight : '—'}</span>
      ),
    },
    {
      key: 'note',
      header: 'Nota',
      render: (rule) => (
        <span className="max-w-56 truncate text-muted-foreground">{rule.note || '—'}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12 text-right',
      render: (rule) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-destructive hover:text-destructive"
          onClick={() => setDeleting(rule)}
          aria-label="Eliminar regla">
          <Trash2Icon className="size-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Reglas de recomendación</h2>
          <p className="text-sm text-muted-foreground">
            Lo que la empresa ajusta sobre lo que el sistema aprende
          </p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon data-icon="inline-start" />
          Nueva regla
        </Button>
      </div>

      {loading ? (
        <LoadingRows rows={5} cols={6} />
      ) : error ? (
        <ErrorState message={getErrorDetail(error)} onRetry={load} />
      ) : (
        <DataTable
          columns={ruleColumns}
          data={rules}
          emptyMessage="No hay reglas explícitas. Crea la primera para ajustar el recomendador."
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pesos del blend</CardTitle>
            <CardDescription>
              {activeStore ? `Configuración de ${activeStore.nombre}` : 'Selecciona una tienda'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeStore && weights ? (
              <form onSubmit={handleSaveWeights} className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="w-cooc">Co-ocurrencia</Label>
                    <Input
                      id="w-cooc"
                      type="number"
                      min="0"
                      step="0.1"
                      value={weights.w_cooccurrence}
                      onChange={(e) =>
                        setWeights((current) => ({
                          ...current,
                          w_cooccurrence: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="w-content">Contenido</Label>
                    <Input
                      id="w-content"
                      type="number"
                      min="0"
                      step="0.1"
                      value={weights.w_content}
                      onChange={(e) =>
                        setWeights((current) => ({ ...current, w_content: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="w-pop">Popularidad</Label>
                    <Input
                      id="w-pop"
                      type="number"
                      min="0"
                      step="0.1"
                      value={weights.w_popularity}
                      onChange={(e) =>
                        setWeights((current) => ({ ...current, w_popularity: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingWeights}>
                    {savingWeights ? 'Guardando…' : 'Guardar pesos'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="text-sm text-muted-foreground">
                Sin tienda seleccionada para cargar los pesos.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SparklesIcon className="size-4" />
              Parejas descubiertas
            </CardTitle>
            <CardDescription>
              Co-ocurrencia (lift) y similitud de contenido para {activeStore?.nombre ?? 'la tienda'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {pairsLoading ? (
              <LoadingRows rows={3} cols={2} />
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium">Co-ocurrencia</div>
                  {pairs.cooccurrence.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Sin pares frecuentes con el soporte mínimo actual.
                    </div>
                  ) : (
                    pairs.cooccurrence.slice(0, 5).map((pair) => (
                      <div
                        key={`${pair.source_sku}-${pair.target_sku}`}
                        className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                        <span>
                          <span className="font-mono">{pair.source_sku}</span> →{' '}
                          <span className="font-mono">{pair.target_sku}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          lift {pair.lift} · {pair.support} tickets
                        </span>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => openPrefilled(pair)}>
                          Crear boost
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium">Contenido similar</div>
                  {pairs.content.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Sin pares por encima del umbral de similitud.
                    </div>
                  ) : (
                    pairs.content.slice(0, 5).map((pair) => (
                      <div
                        key={`${pair.source_sku}-${pair.target_sku}`}
                        className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                        <span>
                          <span className="font-mono">{pair.source_sku}</span> →{' '}
                          <span className="font-mono">{pair.target_sku}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          similitud {pair.similarity}
                        </span>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => openPrefilled(pair)}>
                          Crear boost
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <RuleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stores={stores}
        products={products}
        initial={prefill}
        onSaved={load}
      />

      <AlertDialog open={deleting != null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta regla?</AlertDialogTitle>
            <AlertDialogDescription>
              La regla sobre {deleting?.target_nombre ?? deleting?.target_sku} dejará de aplicarse.
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
