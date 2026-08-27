export function formatMoney(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value ?? 0)
}

export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatNumber(value) {
  return new Intl.NumberFormat('es-MX').format(value ?? 0)
}

export function formatPercent(value, digits = 1) {
  if (value == null) return '—'
  return `${(value * 100).toFixed(digits)}%`
}
