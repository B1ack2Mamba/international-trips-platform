const RU_MONTHS_SHORT = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.']

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  const date = parseDate(value)
  if (!date) return value

  const day = pad2(date.getUTCDate())
  const month = RU_MONTHS_SHORT[date.getUTCMonth()] || ''
  const year = date.getUTCFullYear()

  return `${day} ${month} ${year} г.`
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'

  const date = parseDate(value)
  if (!date) return value

  const day = pad2(date.getUTCDate())
  const month = RU_MONTHS_SHORT[date.getUTCMonth()] || ''
  const year = date.getUTCFullYear()
  const hours = pad2(date.getUTCHours())
  const minutes = pad2(date.getUTCMinutes())

  return `${day} ${month} ${year} г., ${hours}:${minutes}`
}

export function formatCurrency(amount: number | string | null | undefined, currency = 'RUB') {
  if (amount === null || amount === undefined || amount === '') return '—'
  const numeric = typeof amount === 'string' ? Number(amount) : amount
  if (Number.isNaN(numeric)) return String(amount)

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(numeric)
}
