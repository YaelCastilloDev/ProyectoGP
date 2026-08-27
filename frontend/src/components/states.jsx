import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CircleAlertIcon, InboxIcon } from 'lucide-react'

export function LoadingRows({ rows = 5, cols = 5 }) {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-4">
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton key={col} className="h-5 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ message = 'Ocurrió un error al cargar los datos', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center">
      <CircleAlertIcon className="size-8 text-destructive" />
      <div className="max-w-sm text-sm text-muted-foreground">{message}</div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ message = 'No hay datos para mostrar' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center">
      <InboxIcon className="size-8 text-muted-foreground" />
      <div className="text-sm text-muted-foreground">{message}</div>
    </div>
  )
}
