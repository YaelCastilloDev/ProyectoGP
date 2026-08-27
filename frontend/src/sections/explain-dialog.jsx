import * as React from 'react'

import { ErrorState, LoadingRows } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { explainPair, getErrorDetail } from '@/lib/api'

export function ExplainDialog({ open, onOpenChange, storeId, source, target }) {
  const [data, setData] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)

  React.useEffect(() => {
    if (!open || storeId == null || !source || !target) return
    setLoading(true)
    setError(null)
    setData(null)
    explainPair({ store_id: storeId, source, target })
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [open, storeId, source, target])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Explicación del par</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{source}</span> →{' '}
            <span className="font-mono">{target}</span>
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <LoadingRows rows={3} cols={2} />
        ) : error ? (
          <ErrorState message={getErrorDetail(error)} />
        ) : data ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Similitud contenido</div>
                <div className="text-lg font-semibold tabular-nums">
                  {data.content_similarity.toFixed(3)}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Similitud co-ocurrencia</div>
                <div className="text-lg font-semibold tabular-nums">
                  {data.cooccurrence_similarity.toFixed(3)}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Tickets de soporte</div>
                <div className="text-lg font-semibold tabular-nums">{data.support_tickets}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Lift</div>
                <div className="text-lg font-semibold tabular-nums">{data.lift.toFixed(3)}</div>
              </div>
              <div className="col-span-2 rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Score de popularidad</div>
                <div className="text-lg font-semibold tabular-nums">
                  {data.popularity_score.toFixed(3)}
                </div>
              </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">
                Reglas aplicables ({data.applicable_rules.length})
              </div>
              {data.applicable_rules.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Ninguna regla explícita afecta este par.
                </div>
              ) : (
                data.applicable_rules.map((rule, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
                    <Badge variant={rule.action === 'block' ? 'destructive' : 'default'}>
                      {rule.action}
                    </Badge>
                    <span className="text-muted-foreground">peso</span>
                    <span className="font-medium tabular-nums">{rule.weight}</span>
                    {rule.note && (
                      <span className="w-full text-xs text-muted-foreground">{rule.note}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
