export const CUSTOM_MODULE_LAYOUT_VERSION = 19 as const

export const CUSTOM_MODULE_SECTION_COLUMNS = [1, 2, 3, 4] as const
export type CustomModuleSectionColumns = (typeof CUSTOM_MODULE_SECTION_COLUMNS)[number]

export const CUSTOM_MODULE_BLOCK_TYPES = ['kpi', 'table', 'form', 'actions'] as const
export type CustomModuleBlockType = (typeof CUSTOM_MODULE_BLOCK_TYPES)[number]

export const CUSTOM_MODULE_TONES = ['accent', 'success', 'warning', 'danger', 'neutral'] as const
export type CustomModuleTone = (typeof CUSTOM_MODULE_TONES)[number]

export const CUSTOM_MODULE_BUTTON_TONES = ['primary', 'secondary', 'danger'] as const
export type CustomModuleButtonTone = (typeof CUSTOM_MODULE_BUTTON_TONES)[number]

export const CUSTOM_MODULE_FIELD_TYPES = ['text', 'number', 'date', 'select', 'textarea', 'toggle'] as const
export type CustomModuleFieldType = (typeof CUSTOM_MODULE_FIELD_TYPES)[number]

export type CustomModuleKpiItem = {
  id: string
  label: string
  value: string
  note: string
  tone: CustomModuleTone
}

export type CustomModuleTableBlock = {
  id: string
  type: 'table'
  title: string
  subtitle: string
  span: number
  tone: CustomModuleTone
  columns: string[]
  rows: string[][]
  dense: boolean
}

export type CustomModuleKpiBlock = {
  id: string
  type: 'kpi'
  title: string
  subtitle: string
  span: number
  tone: CustomModuleTone
  items: CustomModuleKpiItem[]
}

export type CustomModuleFormField = {
  id: string
  label: string
  type: CustomModuleFieldType
  placeholder: string
  required: boolean
  options: string[]
}

export type CustomModuleFormBlock = {
  id: string
  type: 'form'
  title: string
  subtitle: string
  span: number
  tone: CustomModuleTone
  fields: CustomModuleFormField[]
  submitLabel: string
  secondaryLabel: string
}

export type CustomModuleActionButton = {
  id: string
  label: string
  tone: CustomModuleButtonTone
  hint: string
  href: string
}

export type CustomModuleActionsBlock = {
  id: string
  type: 'actions'
  title: string
  subtitle: string
  span: number
  tone: CustomModuleTone
  buttons: CustomModuleActionButton[]
}

export type CustomModuleBlock =
  | CustomModuleKpiBlock
  | CustomModuleTableBlock
  | CustomModuleFormBlock
  | CustomModuleActionsBlock

export type CustomModuleSection = {
  id: string
  title: string
  description: string
  columns: CustomModuleSectionColumns
  blocks: CustomModuleBlock[]
}

export type CustomModuleLayout = {
  version: typeof CUSTOM_MODULE_LAYOUT_VERSION
  theme: 'tslab'
  density: 'compact'
  eyebrow: string
  statusLine: string
  summary: string
  sections: CustomModuleSection[]
}

export type CustomModuleLayoutSeed = {
  title: string
  description?: string | null
  route?: string | null
  metadata?: unknown
}

const BLOCK_LABELS: Record<CustomModuleBlockType, string> = {
  kpi: 'KPI-панель',
  table: 'Таблица',
  form: 'Форма',
  actions: 'Кнопки',
}

function uid(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return `${prefix}-${random}`
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function text(value: unknown, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function lines(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean)
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, Math.round(numeric)))
}

function tone(value: unknown, fallback: CustomModuleTone): CustomModuleTone {
  return CUSTOM_MODULE_TONES.includes(value as CustomModuleTone) ? (value as CustomModuleTone) : fallback
}

function buttonTone(value: unknown, fallback: CustomModuleButtonTone): CustomModuleButtonTone {
  return CUSTOM_MODULE_BUTTON_TONES.includes(value as CustomModuleButtonTone) ? (value as CustomModuleButtonTone) : fallback
}

function fieldType(value: unknown, fallback: CustomModuleFieldType): CustomModuleFieldType {
  return CUSTOM_MODULE_FIELD_TYPES.includes(value as CustomModuleFieldType) ? (value as CustomModuleFieldType) : fallback
}

function sectionColumns(value: unknown, fallback: CustomModuleSectionColumns): CustomModuleSectionColumns {
  const result = clampInt(value, 1, 4, fallback)
  return (CUSTOM_MODULE_SECTION_COLUMNS.includes(result as CustomModuleSectionColumns) ? result : fallback) as CustomModuleSectionColumns
}

function span(value: unknown, columns: CustomModuleSectionColumns, fallback: number) {
  return clampInt(value, 1, columns, Math.min(fallback, columns))
}

function ensureTableRows(rows: string[][], columnsCount: number) {
  const safeColumnCount = Math.max(1, columnsCount)
  return rows.map((row) => {
    const filled = Array.from({ length: safeColumnCount }, (_, index) => row[index] ?? '')
    return filled.map((cell) => text(cell))
  })
}

export function getCustomModuleBlockLabel(type: CustomModuleBlockType) {
  return BLOCK_LABELS[type]
}

export function createDefaultCustomModuleBlock(type: CustomModuleBlockType, columns: CustomModuleSectionColumns = 4): CustomModuleBlock {
  const safeColumns = sectionColumns(columns, 4)

  switch (type) {
    case 'kpi':
      return {
        id: uid('kpi'),
        type: 'kpi',
        title: 'Контрольный срез',
        subtitle: 'Плотная верхняя панель: метрики, риски, SLA.',
        span: safeColumns,
        tone: 'accent',
        items: [
          { id: uid('kpi-item'), label: 'Очередь', value: '24', note: '3 срочных кейса', tone: 'warning' },
          { id: uid('kpi-item'), label: 'SLA', value: '94%', note: 'средняя скорость ответа', tone: 'success' },
          { id: uid('kpi-item'), label: 'Готовность', value: '61%', note: 'документы на финальной проверке', tone: 'accent' },
          { id: uid('kpi-item'), label: 'Риск', value: '2', note: 'эскалации без владельца', tone: 'danger' },
        ],
      }
    case 'table':
      return {
        id: uid('table'),
        type: 'table',
        title: 'Рабочая таблица',
        subtitle: 'Плоский список без декоративного шума.',
        span: Math.min(safeColumns, 3),
        tone: 'neutral',
        dense: true,
        columns: ['Сущность', 'Этап', 'SLA', 'Владелец'],
        rows: [
          ['CASE-1048', 'Проверка пакета', '02:15', 'Анна'],
          ['CASE-1051', 'Оплата ждёт выписку', '06:40', 'Дмитрий'],
          ['CASE-1055', 'Готово к отправке', '00:45', 'Операционный стол'],
        ],
      }
    case 'form':
      return {
        id: uid('form'),
        type: 'form',
        title: 'Форма управления',
        subtitle: 'Команда фиксирует параметры и отправляет следующий шаг.',
        span: Math.min(safeColumns, 2),
        tone: 'success',
        submitLabel: 'Применить',
        secondaryLabel: 'Сохранить как черновик',
        fields: [
          { id: uid('field'), label: 'Приоритет', type: 'select', placeholder: 'Выбери приоритет', required: true, options: ['Высокий', 'Средний', 'Низкий'] },
          { id: uid('field'), label: 'Срок', type: 'date', placeholder: 'ДД.ММ.ГГГГ', required: false, options: [] },
          { id: uid('field'), label: 'Комментарий', type: 'textarea', placeholder: 'Короткая фиксация решения', required: false, options: [] },
          { id: uid('field'), label: 'Нужна эскалация', type: 'toggle', placeholder: '', required: false, options: [] },
        ],
      }
    case 'actions':
      return {
        id: uid('actions'),
        type: 'actions',
        title: 'Командная панель',
        subtitle: 'Короткие операционные команды под рукой.',
        span: 1,
        tone: 'warning',
        buttons: [
          { id: uid('action'), label: 'Открыть участников', tone: 'primary', hint: 'Быстрый переход в реестр поездок', href: '/dashboard/participants' },
          { id: uid('action'), label: 'Снять риск', tone: 'secondary', hint: 'Проверка узких мест', href: '/dashboard/controlling' },
          { id: uid('action'), label: 'Эскалировать', tone: 'danger', hint: 'Передать наверх', href: '' },
        ],
      }
  }
}

export function createDefaultCustomModuleSection(index = 1): CustomModuleSection {
  if (index === 1) {
    return {
      id: uid('section'),
      title: 'Панель контроля',
      description: 'Сверху — критичные KPI. Ниже — форма и команда действий.',
      columns: 4,
      blocks: [
        createDefaultCustomModuleBlock('kpi', 4),
        createDefaultCustomModuleBlock('form', 4),
        createDefaultCustomModuleBlock('actions', 4),
      ],
    }
  }

  return {
    id: uid('section'),
    title: `Секция ${index}`,
    description: 'Внутренний контур раздела.',
    columns: 3,
    blocks: [createDefaultCustomModuleBlock('table', 3)],
  }
}

export function createDefaultCustomModuleLayout(seed: Omit<CustomModuleLayoutSeed, 'metadata'> = { title: 'Новый раздел' }): CustomModuleLayout {
  const title = text(seed.title, 'Новый раздел')
  const description = text(seed.description, `Внутренний операционный экран для раздела «${title}».`)
  const route = text(seed.route, '/dashboard/custom/new-section')

  return {
    version: CUSTOM_MODULE_LAYOUT_VERSION,
    theme: 'tslab',
    density: 'compact',
    eyebrow: 'tslab.runtime',
    statusLine: `${route} · layout v19 ready`,
    summary: description,
    sections: [
      createDefaultCustomModuleSection(1),
      {
        id: uid('section'),
        title: 'Рабочая таблица',
        description: 'Табличный слой для плоского обзора и моментального входа в кейс.',
        columns: 3,
        blocks: [createDefaultCustomModuleBlock('table', 3)],
      },
    ],
  }
}

function normalizeKpiItem(raw: unknown, index: number): CustomModuleKpiItem | null {
  const value = asRecord(raw)
  if (!value) return null
  return {
    id: text(value.id, uid(`kpi-item-${index + 1}`)),
    label: text(value.label, `Метрика ${index + 1}`),
    value: text(value.value, '0'),
    note: text(value.note, 'без пояснения'),
    tone: tone(value.tone, 'accent'),
  }
}

function normalizeFormField(raw: unknown, index: number): CustomModuleFormField | null {
  const value = asRecord(raw)
  if (!value) return null
  return {
    id: text(value.id, uid(`field-${index + 1}`)),
    label: text(value.label, `Поле ${index + 1}`),
    type: fieldType(value.type, 'text'),
    placeholder: text(value.placeholder),
    required: Boolean(value.required),
    options: lines(Array.isArray(value.options) ? value.options.map((item) => text(item)) : []),
  }
}

function normalizeActionButton(raw: unknown, index: number): CustomModuleActionButton | null {
  const value = asRecord(raw)
  if (!value) return null
  return {
    id: text(value.id, uid(`button-${index + 1}`)),
    label: text(value.label, `Команда ${index + 1}`),
    tone: buttonTone(value.tone, 'secondary'),
    hint: text(value.hint),
    href: text(value.href),
  }
}

function normalizeBlock(raw: unknown, columns: CustomModuleSectionColumns, index: number): CustomModuleBlock | null {
  const value = asRecord(raw)
  if (!value) return null
  const type = CUSTOM_MODULE_BLOCK_TYPES.includes(value.type as CustomModuleBlockType)
    ? (value.type as CustomModuleBlockType)
    : null
  if (!type) return null

  const common = (defaults: CustomModuleBlock) => ({
    id: text(value.id, defaults.id),
    type,
    title: text(value.title, defaults.title),
    subtitle: text(value.subtitle, defaults.subtitle),
    span: span(value.span, columns, defaults.span),
    tone: tone(value.tone, defaults.tone),
  })

  switch (type) {
    case 'kpi': {
      const defaults = createDefaultCustomModuleBlock('kpi', columns) as CustomModuleKpiBlock
      const items = (Array.isArray(value.items) ? value.items : [])
        .map(normalizeKpiItem)
        .filter((item): item is CustomModuleKpiItem => Boolean(item))
      return {
        ...common(defaults),
        type: 'kpi',
        items: items.length ? items : defaults.items,
      }
    }
    case 'table': {
      const defaults = createDefaultCustomModuleBlock('table', columns) as CustomModuleTableBlock
      const rawColumns = lines(Array.isArray(value.columns) ? value.columns.map((item) => text(item)) : [])
      const columnsList = rawColumns.length ? rawColumns : defaults.columns
      const rawRows = Array.isArray(value.rows)
        ? value.rows.map((row) => (Array.isArray(row) ? row.map((cell) => text(cell)) : []))
        : []
      return {
        ...common(defaults),
        type: 'table',
        columns: columnsList,
        rows: rawRows.length ? ensureTableRows(rawRows, columnsList.length) : defaults.rows,
        dense: value.dense === undefined ? defaults.dense : Boolean(value.dense),
      }
    }
    case 'form': {
      const defaults = createDefaultCustomModuleBlock('form', columns) as CustomModuleFormBlock
      const fields = (Array.isArray(value.fields) ? value.fields : [])
        .map(normalizeFormField)
        .filter((field): field is CustomModuleFormField => Boolean(field))
      return {
        ...common(defaults),
        type: 'form',
        fields: fields.length ? fields : defaults.fields,
        submitLabel: text(value.submitLabel, defaults.submitLabel),
        secondaryLabel: text(value.secondaryLabel, defaults.secondaryLabel),
      }
    }
    case 'actions': {
      const defaults = createDefaultCustomModuleBlock('actions', columns) as CustomModuleActionsBlock
      const buttons = (Array.isArray(value.buttons) ? value.buttons : [])
        .map(normalizeActionButton)
        .filter((button): button is CustomModuleActionButton => Boolean(button))
      return {
        ...common(defaults),
        type: 'actions',
        buttons: buttons.length ? buttons : defaults.buttons,
      }
    }
  }
}

function normalizeSection(raw: unknown, index: number): CustomModuleSection | null {
  const value = asRecord(raw)
  if (!value) return null
  const defaults = createDefaultCustomModuleSection(index + 1)
  const columns = sectionColumns(value.columns, defaults.columns)
  const blocks = (Array.isArray(value.blocks) ? value.blocks : [])
    .map((block, blockIndex) => normalizeBlock(block, columns, blockIndex))
    .filter((block): block is CustomModuleBlock => Boolean(block))

  return {
    id: text(value.id, defaults.id),
    title: text(value.title, defaults.title),
    description: text(value.description, defaults.description),
    columns,
    blocks: blocks.length ? blocks : defaults.blocks.map((block) => normalizeBlock(block, columns, 0) ?? createDefaultCustomModuleBlock('kpi', columns)),
  }
}

export function normalizeCustomModuleLayout(seed: CustomModuleLayoutSeed): CustomModuleLayout {
  const defaults = createDefaultCustomModuleLayout(seed)
  const raw = asRecord(seed.metadata) ?? {}
  const sections = (Array.isArray(raw.sections) ? raw.sections : [])
    .map((section, index) => normalizeSection(section, index))
    .filter((section): section is CustomModuleSection => Boolean(section))

  return {
    version: CUSTOM_MODULE_LAYOUT_VERSION,
    theme: 'tslab',
    density: 'compact',
    eyebrow: text(raw.eyebrow, defaults.eyebrow),
    statusLine: text(raw.statusLine, defaults.statusLine),
    summary: text(raw.summary, defaults.summary),
    sections: sections.length ? sections : defaults.sections,
  }
}
