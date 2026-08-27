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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getErrorDetail, importSales } from '@/lib/api'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

function emptyRow() {
  return { ticket_id: '', sku: '', cantidad: '1', fecha: new Date().toISOString().slice(0, 10) }
}

export function SalesImportDialog({ open, onOpenChange, storeId, products, onImported }) {
  const [rows, setRows] = React.useState([emptyRow()])
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (open) setRows([emptyRow()])
  }, [open])

  function updateRow(index, field) {
    return (value) => {
      setRows((current) =>
        current.map((row, i) => (i === index ? { ...row, [field]: value } : row))
      )
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const payload = rows
      .map((row) => ({
        ticket_id: row.ticket_id.trim(),
        sku: row.sku,
        cantidad: Number(row.cantidad) || 0,
        fecha: row.fecha,
      }))
      .filter((row) => row.ticket_id && row.sku && row.cantidad > 0 && row.fecha)
    if (payload.length === 0) {
      toast.error('Agrega al menos una línea válida (ticket, SKU, cantidad y fecha)')
      return
    }
    setBusy(true)
    try {
      const result = await importSales(storeId, payload)
      toast.success(`${result.imported} línea(s) importadas al historial`)
      onOpenChange(false)
      onImported?.()
    } catch (err) {
      toast.error(getErrorDetail(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar historial de ventas</DialogTitle>
          <DialogDescription>
            Agrega las líneas de los tickets históricos. La importación es solo de lectura: no
            descuenta stock.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="hidden grid-cols-[1fr_1.5fr_0.7fr_1fr_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
              <span>Ticket</span>
              <span>Producto</span>
              <span>Cantidad</span>
              <span>Fecha</span>
              <span />
            </div>
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
              {rows.map((row, index) => (
                <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.5fr_0.7fr_1fr_2rem]">
                  <Input
                    value={row.ticket_id}
                    onChange={(e) => updateRow(index, 'ticket_id')(e.target.value)}
                    placeholder="T-1001"
                    maxLength={32}
                  />
                  <Select value={row.sku} onValueChange={updateRow(index, 'sku')}>
                    <SelectTrigger className="w-full" aria-label="Producto">
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
                  <Input
                    type="number"
                    min="1"
                    value={row.cantidad}
                    onChange={(e) => updateRow(index, 'cantidad')(e.target.value)}
                  />
                  <Input
                    type="date"
                    value={row.fecha}
                    onChange={(e) => updateRow(index, 'fecha')(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    disabled={rows.length === 1}
                    onClick={() =>
                      setRows((current) => current.filter((_, i) => i !== index))
                    }
                    aria-label="Quitar línea">
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setRows((current) => [...current, emptyRow()])}>
              <PlusIcon data-icon="inline-start" />
              Agregar línea
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy ? 'Importando…' : 'Importar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
