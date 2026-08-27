import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
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
import { createRule, getErrorDetail } from '@/lib/api'
import { toast } from 'sonner'

const emptyForm = {
  store_id: 'none',
  source_sku: 'none',
  target_sku: '',
  action: 'boost',
  weight: '1.0',
  note: '',
}

export function RuleFormDialog({ open, onOpenChange, stores, products, initial = null, onSaved }) {
  const [form, setForm] = React.useState(emptyForm)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm({
        store_id: 'none',
        source_sku: initial?.source_sku ?? 'none',
        target_sku: initial?.target_sku ?? '',
        action: initial?.action ?? 'boost',
        weight: String(initial?.weight ?? '1.0'),
        note: initial?.note ?? '',
      })
    }
  }, [open, initial])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.target_sku) {
      toast.error('Selecciona el producto objetivo')
      return
    }
    const payload = {
      store_id: form.store_id === 'none' ? null : Number(form.store_id),
      source_sku: form.source_sku === 'none' ? null : form.source_sku,
      target_sku: form.target_sku,
      action: form.action,
      weight: Number(form.weight) || 1,
      note: form.note.trim(),
    }
    setBusy(true)
    try {
      await createRule(payload)
      toast.success('Regla creada')
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      toast.error(getErrorDetail(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva regla</DialogTitle>
          <DialogDescription>
            Decide si un producto aparece más arriba en las sugerencias (impulsar) o se
            oculta por completo (bloquear).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rule-store">Tienda</Label>
              <Select value={form.store_id} onValueChange={(value) => setForm({ ...form, store_id: value })}>
                <SelectTrigger id="rule-store" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">Todas las tiendas</SelectItem>
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
              <Label htmlFor="rule-source">Se aplica cuando lleva</Label>
              <Select
                value={form.source_sku}
                onValueChange={(value) => setForm({ ...form, source_sku: value })}>
                <SelectTrigger id="rule-source" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">Siempre (sin condición)</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.sku} value={product.sku}>
                        {product.sku} · {product.nombre}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                La regla aplica cuando el cliente lleva ese producto en el carrito.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rule-target">Producto a impulsar o bloquear</Label>
              <Select
                value={form.target_sku}
                onValueChange={(value) => setForm({ ...form, target_sku: value })}>
                <SelectTrigger id="rule-target" className="w-full">
                  <SelectValue placeholder="Selecciona un producto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {products.map((product) => (
                      <SelectItem key={product.sku} value={product.sku}>
                        {product.sku} · {product.nombre}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rule-action">Acción</Label>
              <Select
                value={form.action}
                onValueChange={(value) => setForm({ ...form, action: value })}>
                <SelectTrigger id="rule-action" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boost">Impulsar (aparece más arriba)</SelectItem>
                  <SelectItem value="block">Bloquear (se oculta)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rule-weight">Fuerza del impulso</Label>
              <Input
                id="rule-weight"
                type="number"
                min="0"
                step="0.1"
                value={form.weight}
                disabled={form.action === 'block'}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {form.action === 'block'
                  ? 'No aplica al bloquear.'
                  : 'Veces que se multiplica su visibilidad. 2 = doble de fuerza.'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rule-note">Nota</Label>
            <Input
              id="rule-note"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Ej. Oferta de temporada"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy ? 'Creando…' : 'Crear regla'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
