import * as React from 'react'

import { DataTable } from '@/components/data-table'
import { ErrorState, LoadingRows } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getErrorDetail, getEvaluation } from '@/lib/api'
import { formatDate, formatPercent } from '@/lib/format'
import { RefreshCwIcon } from 'lucide-react'

const strategyNames = {
  random: 'Aleatorio',
  popularity_baseline: 'Popularidad global',
  cooccurrence: 'Co-ocurrencia',
  content: 'Contenido',
  hybrid: 'Híbrido',
}

export function EvaluationSection() {
  const [report, setReport] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReport(await getEvaluation())
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const columns = [
    {
      key: 'name',
      header: 'Estrategia',
      render: (row) => strategyNames[row.name] ?? row.name,
    },
    {
      key: 'hit_rate',
      header: 'HitRate@K',
      className: 'text-right',
      render: (row) => (
        <span className="font-semibold tabular-nums">{formatPercent(row.hit_rate, 2)}</span>
      ),
    },
    {
      key: 'precision',
      header: 'Precision@K',
      className: 'text-right',
      render: (row) => (
        <span className="tabular-nums">{formatPercent(row.precision, 2)}</span>
      ),
    },
    {
      key: 'coverage',
      header: 'Cobertura',
      className: 'text-right',
      render: (row) => (
        <span className="tabular-nums">{formatPercent(row.coverage, 2)}</span>
      ),
    },
    {
      key: 'n_hits',
      header: 'Hits / Queries',
      className: 'text-right',
      render: (row) => (
        <span className="text-muted-foreground tabular-nums">
          {row.n_hits} / {row.n_queries}
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Evaluación offline</h2>
          <p className="text-sm text-muted-foreground">
            Holdout temporal + leave-one-out sobre los tickets históricos
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCwIcon data-icon="inline-start" />
          Recalcular
        </Button>
      </div>

      {loading ? (
        <LoadingRows rows={6} cols={4} />
      ) : error ? (
        <ErrorState message={getErrorDetail(error)} onRetry={load} />
      ) : report ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardDescription>Fecha de corte</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {formatDate(report.split_date)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>K</CardDescription>
                <CardTitle className="text-xl tabular-nums">{report.k}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Tickets de entrenamiento</CardDescription>
                <CardTitle className="text-xl tabular-nums">{report.n_train_tickets}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Tickets de prueba</CardDescription>
                <CardTitle className="text-xl tabular-nums">{report.n_test_tickets}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <DataTable
            columns={columns}
            data={report.strategies}
            getRowId={(row) => row.name}
            pageSizeOptions={[10]}
          />

          {Object.keys(report.hybrid_by_store).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Híbrido por tienda (HitRate@K)</CardTitle>
                <CardDescription>
                  El mismo híbrido evaluado solo con tickets de cada tienda
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {Object.entries(report.hybrid_by_store).map(([store, hitRate]) => (
                  <Badge key={store} variant="outline" className="px-2.5 py-1">
                    {store}: {formatPercent(hitRate, 2)}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}
