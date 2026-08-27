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

const weightFields = [
  {
    key: 'w_cooccurrence',
    id: 'w-cooc',
    label: 'Comprados juntos',
    help: 'Productos que suelen comprarse en la misma venta.',
  },
  {
    key: 'w_content',
    id: 'w-content',
    label: 'Atributos similares',
    help: 'Productos parecidos por nombre, categoría o material.',
  },
  {
    key: 'w_popularity',
    id: 'w-pop',
    label: 'Más vendidos',
    help: 'Los productos más vendidos de la tienda.',
  },
]

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
      toast.success('Preferencias guardadas')
    } catch (err) {
      toast.error(getErrorDetail(err))
    } finally {
      setSavingWeights(false)
    }
  }

  const ruleColumns = [
    {
      key: 'target',
      header: 'Producto',
      render: (rule) => (
        <div className="flex flex-col">
          <span className="font-medium">{rule.target_nombre}</span>
          <span className="font-mono text-xs text-muted-foreground">{rule.target_sku}</span>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Se aplica cuando lleva',
      render: (rule) =>
        rule.source_sku ? (
          <div className="flex flex-col">
            <span>{productNames.get(rule.source_sku) ?? rule.source_sku}</span>
            <span className="font-mono text-xs text-muted-foreground">{rule.source_sku}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">Siempre</span>
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
          {rule.action === 'block' ? 'Bloquear' : 'Impulsar'}
        </Badge>
      ),
    },
    {
      key: 'weight',
      header: 'Fuerza del impulso',
      className: 'text-right',
      render: (rule) =>
        rule.action === 'boost' ? (
          <span className="tabular-nums">×{rule.weight}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
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
            Ajusta el recomendador a tu negocio: impulsa o bloquea productos y define cuánto
            influye cada factor en las sugerencias.
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
          emptyMessage="Aún no hay reglas. Crea la primera para controlar qué productos se impulsan o bloquean."
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Importancia de cada factor</CardTitle>
            <CardDescription>
              Cuánto influye cada señal en las recomendaciones
              {activeStore ? ` de ${activeStore.nombre}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeStore && weights ? (
              <form onSubmit={handleSaveWeights} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {weightFields.map((field) => (
                    <div key={field.key} className="flex flex-col gap-2">
                      <Label htmlFor={field.id}>{field.label}</Label>
                      <Input
                        id={field.id}
                        type="number"
                        min="0"
                        step="0.1"
                        value={weights[field.key]}
                        onChange={(e) =>
                          setWeights((current) => ({
                            ...current,
                            [field.key]: e.target.value,
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">{field.help}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingWeights}>
                    {savingWeights ? 'Guardando…' : 'Guardar'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="text-sm text-muted-foreground">
                Selecciona una tienda para ajustar sus preferencias.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SparklesIcon className="size-4" />
              Relaciones descubiertas
            </CardTitle>
            <CardDescription>
              Patrones detectados en las ventas. Conviértelos en reglas con un clic.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {pairsLoading ? (
              <LoadingRows rows={3} cols={2} />
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">Se compran juntos</span>
                    <span className="text-xs text-muted-foreground">
                      en las mismas ventas, con más frecuencia de lo esperado
                    </span>
                  </div>
                  {pairs.cooccurrence.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Aún no hay productos que se compren juntos con la frecuencia mínima.
                    </div>
                  ) : (
                    pairs.cooccurrence.slice(0, 5).map((pair) => (
                      <div
                        key={`${pair.source_sku}-${pair.target_sku}`}
                        className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                        <span>
                          <span className="font-medium">
                            {productNames.get(pair.source_sku) ?? pair.source_sku}
                          </span>
                          {' → '}
                          <span className="font-medium">
                            {productNames.get(pair.target_sku) ?? pair.target_sku}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {pair.support} ventas juntos · {pair.lift}× más de lo esperado
                        </span>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => openPrefilled(pair)}>
                          Impulsar
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
