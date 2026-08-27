import * as React from 'react'

import { DataTable } from '@/components/data-table'
import { ErrorState, LoadingRows } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getErrorDetail, getEvaluation } from '@/lib/api'
import { formatDate, formatPercent } from '@/lib/format'
import { InfoIcon, RefreshCwIcon } from 'lucide-react'

const strategyNames = {
  random: 'Aleatorio',
  popularity_baseline: 'Solo populares',
  cooccurrence: 'Solo comprados juntos',
  content: 'Solo atributos',
  hybrid: 'Híbrido (todos los factores)',
}

function HeaderWithHelp({ label, help }) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-4 hover:text-foreground"
          >
            {label}
            <InfoIcon className="size-3.5 opacity-60" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-normal text-left">
          {help}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
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
      header: (
        <HeaderWithHelp
          label="Tasa de aciertos"
          help="Porcentaje de consultas en las que al menos una de las sugerencias coincide con lo que el cliente realmente compró después."
        />
      ),
      className: 'text-right',
      render: (row) => (
        <span className="font-semibold tabular-nums">{formatPercent(row.hit_rate, 2)}</span>
      ),
    },
    {
      key: 'precision',
      header: (
        <HeaderWithHelp
          label="Precisión"
          help="Porcentaje de sugerencias acertadas dentro de cada lista de recomendaciones."
        />
      ),
      className: 'text-right',
      render: (row) => (
        <span className="tabular-nums">{formatPercent(row.precision, 2)}</span>
      ),
    },
    {
      key: 'coverage',
      header: (
        <HeaderWithHelp
          label="Cobertura del catálogo"
          help="Porcentaje del catálogo que llega a recomendarse al menos una vez. Un valor bajo indica un motor repetitivo que siempre sugiere lo mismo."
        />
      ),
      className: 'text-right',
      render: (row) => (
        <span className="tabular-nums">{formatPercent(row.coverage, 2)}</span>
      ),
    },
    {
      key: 'n_hits',
      header: (
        <HeaderWithHelp
          label="Aciertos / Consultas"
          help="Detalle de la tasa de aciertos: cuántas consultas acertaron sobre el total de consultas evaluadas."
        />
      ),
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
            Simula cómo habría recomendado el sistema en el pasado: entrena con las compras
            anteriores a la fecha de corte y mide si lo sugerido coincidió con lo que el
            cliente terminó comprando.
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
                <p className="text-xs text-muted-foreground">
                  Compras anteriores: entrenan el motor. Posteriores: se usan para medir.
                </p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Recomendaciones por consulta (Top-K)</CardDescription>
                <CardTitle className="text-xl tabular-nums">{report.k}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Cuántas sugerencias devuelve el motor en cada consulta evaluada.
                </p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Compras para entrenar</CardDescription>
                <CardTitle className="text-xl tabular-nums">{report.n_train_tickets}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Compras históricas usadas para aprender los patrones.
                </p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Compras para medir</CardDescription>
                <CardTitle className="text-xl tabular-nums">{report.n_test_tickets}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Compras sobre las que se comprueba si el motor acierta.
                </p>
              </CardHeader>
            </Card>
          </div>

          <DataTable
            columns={columns}
            data={report.strategies}
            getRowId={(row) => row.name}
            pageSizeOptions={[10]}
          />
        </>
      ) : null}
    </div>
  )
}
