import { NavMain } from '@/components/nav-main'
import { StoreSwitcher } from '@/components/store-switcher'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  ClipboardListIcon,
  HammerIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ReceiptIcon,
  FlaskConicalIcon,
  SlidersHorizontalIcon,
} from 'lucide-react'

const navItems = [
  {
    title: 'Dashboard',
    url: '/',
    icon: <LayoutDashboardIcon />,
  },
  {
    title: 'Productos',
    url: '/productos',
    icon: <PackageIcon />,
  },
  {
    title: 'Ventas',
    url: '/ventas',
    icon: <ReceiptIcon />,
  },
  {
    title: 'Compras',
    url: '/compras',
    icon: <ClipboardListIcon />,
  },
  {
    title: 'Reglas',
    url: '/reglas',
    icon: <SlidersHorizontalIcon />,
  },
  {
    title: 'Evaluación',
    url: '/evaluacion',
    icon: <FlaskConicalIcon />,
  },
]

export function AppSidebar(props) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <a href="/">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <HammerIcon className="size-4" />
                </div>
                <span className="text-base font-semibold">Ferretería</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <StoreSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-1 text-xs text-muted-foreground">
          Inventario compartido · Recsys híbrido
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
