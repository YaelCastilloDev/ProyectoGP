import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export const api = axios.create({ baseURL: API_URL })

export function getErrorDetail(error) {
  const detail = error?.response?.data?.detail
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(', ')
  }
  if (typeof detail === 'string' && detail.trim()) return detail
  if (error?.code === 'ERR_NETWORK') return 'No se pudo conectar con el servidor'
  return error?.message || 'Error desconocido'
}

export const listProducts = () => api.get('/products').then((r) => r.data)
export const createProduct = (payload) => api.post('/products', payload).then((r) => r.data)
export const updateProduct = (sku, payload) => api.patch(`/products/${sku}`, payload).then((r) => r.data)
export const deleteProduct = (sku) => api.delete(`/products/${sku}`).then(() => null)

export const listStores = () => api.get('/stores').then((r) => r.data)
export const createStore = (nombre) => api.post('/stores', { nombre }).then((r) => r.data)

export const listSales = (storeId, params = {}) =>
  api.get(`/stores/${storeId}/sales`, { params }).then((r) => r.data)
export const importSales = (storeId, rows) =>
  api.post(`/stores/${storeId}/sales/import`, { rows }).then((r) => r.data)

export const createPurchase = (storeId, items) =>
  api.post(`/stores/${storeId}/purchases`, { items }).then((r) => r.data)

export const getRecommendations = (params) =>
  api.get('/recommendations', { params }).then((r) => r.data)
export const explainPair = (params) =>
  api.get('/recommendations/explain', { params }).then((r) => r.data)

export const listRules = () => api.get('/rules').then((r) => r.data)
export const createRule = (payload) => api.post('/rules', payload).then((r) => r.data)
export const deleteRule = (id) => api.delete(`/rules/${id}`).then(() => null)
export const getDiscoveredPairs = (params) =>
  api.get('/rules/discovered', { params }).then((r) => r.data)
export const getWeights = (storeId) => api.get(`/stores/${storeId}/weights`).then((r) => r.data)
export const setWeights = (storeId, payload) =>
  api.put(`/stores/${storeId}/weights`, payload).then((r) => r.data)

export const getEvaluation = () => api.get('/evaluation').then((r) => r.data)
