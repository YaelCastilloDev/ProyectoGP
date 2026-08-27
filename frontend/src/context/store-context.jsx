import * as React from 'react'
import { toast } from 'sonner'

import { createStore as apiCreateStore, getErrorDetail, listStores } from '@/lib/api'

const StoreContext = React.createContext(null)

export function StoreProvider({ children }) {
  const [stores, setStores] = React.useState([])
  const [activeStoreId, setActiveStoreIdState] = React.useState(() => {
    const saved = localStorage.getItem('activeStoreId')
    return saved ? Number(saved) : null
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)

  const setActiveStoreId = React.useCallback((id) => {
    setActiveStoreIdState(id)
    if (id == null) {
      localStorage.removeItem('activeStoreId')
    } else {
      localStorage.setItem('activeStoreId', String(id))
    }
  }, [])

  const refreshStores = React.useCallback(async (silent = true) => {
    try {
      const data = await listStores()
      setStores(data)
      setError(null)
      setActiveStoreIdState((current) => {
        if (current == null || !data.some((store) => store.id === current)) {
          return data.length > 0 ? data[0].id : null
        }
        return current
      })
      return data
    } catch (err) {
      if (!silent) {
        setError(err)
      }
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const createStore = React.useCallback(
    async (nombre) => {
      const store = await apiCreateStore(nombre)
      toast.success(`Tienda creada: ${store.nombre}`)
      await refreshStores(true)
      setActiveStoreId(store.id)
      return store
    },
    [refreshStores, setActiveStoreId]
  )

  React.useEffect(() => {
    refreshStores(false).catch((err) => {
      setError(err)
      setLoading(false)
    })
  }, [refreshStores])

  const activeStore = stores.find((store) => store.id === activeStoreId) ?? null

  const value = React.useMemo(
    () => ({
      stores,
      activeStoreId,
      activeStore,
      setActiveStoreId,
      createStore,
      refreshStores,
      loading,
      error,
      errorDetail: error ? getErrorDetail(error) : null,
    }),
    [stores, activeStoreId, activeStore, setActiveStoreId, createStore, refreshStores, loading, error]
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const context = React.useContext(StoreContext)
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider')
  }
  return context
}
