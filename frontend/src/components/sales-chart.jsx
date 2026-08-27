import * as React from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import { EmptyState } from '@/components/states'
import { formatDate, formatMoney } from '@/lib/format'

const chartConfig = {
  ventas: {
    label: 'Ventas',
    color: 'var(--primary)',
  },
  unidades: {
    label: 'Unidades',
    color: 'var(--muted-foreground)',
  },
}

function buildSeries(rows) {
  const byDate = new Map()
  for (const row of rows) {
    const entry = byDate.get(row.fecha) ?? { fecha: row.fecha, ventas: 0, unidades: 0 }
    entry.ventas += row.subtotal
    entry.unidades += row.cantidad
    byDate.set(row.fecha, entry)
  }
  return [...byDate.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function SalesChart({ rows }) {
  const [timeRange, setTimeRange] = React.useState('all')

  const series = React.useMemo(() => buildSeries(rows), [rows])

  const filtered = React.useMemo(() => {
    if (timeRange === 'all' || series.length === 0) return series
    const days = timeRange === '7d' ? 7 : 30
    const last = series[series.length - 1].fecha
    const cutoff = new Date(`${last}T00:00:00`)
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffIso = cutoff.toISOString().slice(0, 10)
    return series.filter((point) => point.fecha >= cutoffIso)
  }, [series, timeRange])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas por fecha</CardTitle>
        <CardDescription>Historial de la tienda activa</CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-3! sm:flex">
            <ToggleGroupItem value="7d">7 días</ToggleGroupItem>
            <ToggleGroupItem value="30d">30 días</ToggleGroupItem>
            <ToggleGroupItem value="all">Todo</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger size="sm" className="flex w-32 sm:hidden" aria-label="Rango">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 días</SelectItem>
              <SelectItem value="30d">30 días</SelectItem>
              <SelectItem value="all">Todo</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {filtered.length === 0 ? (
          <EmptyState message="No hay ventas registradas en este rango" />
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={filtered}>
              <defs>
                <linearGradient id="fillVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-ventas)" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="var(--color-ventas)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillUnidades" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-unidades)" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="var(--color-unidades)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="fecha"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(`${value}T00:00:00`)
                  return date.toLocaleDateString('es-MX', {
                    month: 'short',
                    day: 'numeric',
                  })
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatDate(value)}
                    formatter={(value, name) => {
                      const label = chartConfig[name]?.label ?? name
                      return [name === 'ventas' ? formatMoney(value) : value, label]
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="unidades"
                type="natural"
                fill="url(#fillUnidades)"
                stroke="var(--color-unidades)"
                fillOpacity={0.6}
              />
              <Area
                dataKey="ventas"
                type="natural"
                fill="url(#fillVentas)"
                stroke="var(--color-ventas)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
