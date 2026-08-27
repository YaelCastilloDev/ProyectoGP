import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useStore } from '@/context/store-context'

export function SiteHeader({ title }) {
  const { stores, activeStoreId, setActiveStoreId } = useStore()

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">Tienda activa</span>
          <Select
            value={activeStoreId == null ? undefined : String(activeStoreId)}
            onValueChange={(value) => setActiveStoreId(Number(value))}>
            <SelectTrigger size="sm" className="w-44" aria-label="Tienda activa">
              <SelectValue placeholder="Elegir tienda" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {stores.map((store) => (
                  <SelectItem key={store.id} value={String(store.id)}>
                    {store.nombre}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </header>
  )
}
