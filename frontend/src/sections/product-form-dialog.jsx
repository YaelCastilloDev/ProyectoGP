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
import { createProduct, getErrorDetail, updateProduct } from '@/lib/api'
import { toast } from 'sonner'

const emptyForm = {
  sku: '',
  nombre: '',
  descripcion: '',
  categoria: '',
  material: '',
  uso_recomendado: '',
  precio: '',
  stock: '',
}

export function ProductFormDialog({ open, onOpenChange, product = null, onSaved }) {
  const [form, setForm] = React.useState(emptyForm)
  const [busy, setBusy] = React.useState(false)
  const isEditing = product != null

  React.useEffect(() => {
    if (open) {
      setForm(
        product
          ? {
              sku: product.sku,
              nombre: product.nombre,
              descripcion: product.descripcion ?? '',
              categoria: product.categoria,
              material: product.material ?? '',
              uso_recomendado: product.uso_recomendado ?? '',
              precio: String(product.precio),
              stock: String(product.stock),
            }
          : emptyForm
      )
    }
  }, [open, product])

  function setField(field) {
    return (e) => setForm((current) => ({ ...current, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.sku.trim() || !form.nombre.trim() || !form.categoria.trim()) {
      toast.error('SKU, nombre y categoría son obligatorios')
      return
    }
    const payload = {
      sku: form.sku.trim(),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      categoria: form.categoria.trim(),
      material: form.material.trim(),
      uso_recomendado: form.uso_recomendado.trim(),
      precio: Number(form.precio) || 0,
      stock: Number(form.stock) || 0,
    }
    setBusy(true)
    try {
      if (isEditing) {
        await updateProduct(product.sku, {
          nombre: payload.nombre,
          descripcion: payload.descripcion,
          categoria: payload.categoria,
          material: payload.material,
          uso_recomendado: payload.uso_recomendado,
          precio: payload.precio,
          stock: payload.stock,
        })
        toast.success(`Producto actualizado: ${payload.nombre}`)
      } else {
        await createProduct(payload)
        toast.success(`Producto creado: ${payload.nombre}`)
      }
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Modifica los datos de ${product.sku}.`
              : 'Agrega un producto al catálogo compartido.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={setField('sku')}
                disabled={isEditing}
                placeholder="SKU001"
                maxLength={32}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={setField('nombre')}
                placeholder="Martillo de carpintero"
                maxLength={160}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria">Categoría</Label>
              <Input
                id="categoria"
                value={form.categoria}
                onChange={setField('categoria')}
                placeholder="Herramientas"
                maxLength={64}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="material">Material</Label>
              <Input
                id="material"
                value={form.material}
                onChange={setField('material')}
                placeholder="Acero"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="uso">Uso recomendado</Label>
              <Input
                id="uso"
                value={form.uso_recomendado}
                onChange={setField('uso_recomendado')}
                placeholder="Interior / exterior"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="precio">Precio (MXN)</Label>
                <Input
                  id="precio"
                  type="number"
                  min="0"
                  value={form.precio}
                  onChange={setField('precio')}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={setField('stock')}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Input
              id="descripcion"
              value={form.descripcion}
              onChange={setField('descripcion')}
              placeholder="Descripción breve del producto"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
