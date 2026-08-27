import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { StoreProvider } from '@/context/store-context'
import { DashboardSection } from '@/sections/dashboard-section'
import { EvaluationSection } from '@/sections/evaluation-section'
import { ProductsSection } from '@/sections/products-section'
import { PurchasesSection } from '@/sections/purchases-section'
import { RecommendationsSection } from '@/sections/recommendations-section'
import { RulesSection } from '@/sections/rules-section'
import { SalesSection } from '@/sections/sales-section'

const sections = [
  { path: '/', title: 'Dashboard', element: <DashboardSection /> },
  { path: '/productos', title: 'Productos', element: <ProductsSection /> },
  { path: '/ventas', title: 'Ventas', element: <SalesSection /> },
  { path: '/compras', title: 'Compras', element: <PurchasesSection /> },
  {
    path: '/recomendaciones',
    title: 'Recomendaciones',
    element: <RecommendationsSection />,
  },
  { path: '/reglas', title: 'Reglas', element: <RulesSection /> },
  { path: '/evaluacion', title: 'Evaluación', element: <EvaluationSection /> },
]

function AppShell() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Routes>
            {sections.map((section) => (
              <Route
                key={section.path}
                path={section.path}
                element={
                  <>
                    <SiteHeader title={section.title} />
                    <div className="flex flex-1 flex-col">
                      <div className="@container/main flex flex-1 flex-col gap-2">
                        {section.element}
                      </div>
                    </div>
                  </>
                }
              />
            ))}
          </Routes>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <AppShell />
      </StoreProvider>
    </BrowserRouter>
  )
}

export default App
