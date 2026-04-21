'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { CustomModuleScreen } from '@/components/custom-module-screen'
import type { WorkspaceCustomModuleScreen } from '@/lib/influence-spaces'
import {
  CUSTOM_MODULE_BLOCK_TYPES,
  CUSTOM_MODULE_BUTTON_TONES,
  CUSTOM_MODULE_FIELD_TYPES,
  CUSTOM_MODULE_SECTION_COLUMNS,
  CUSTOM_MODULE_TONES,
  createDefaultCustomModuleBlock,
  createDefaultCustomModuleLayout,
  createDefaultCustomModuleSection,
  getCustomModuleBlockLabel,
  normalizeCustomModuleLayout,
  type CustomModuleActionButton,
  type CustomModuleActionsBlock,
  type CustomModuleBlock,
  type CustomModuleBlockType,
  type CustomModuleButtonTone,
  type CustomModuleFieldType,
  type CustomModuleFormBlock,
  type CustomModuleFormField,
  type CustomModuleKpiBlock,
  type CustomModuleLayout,
  type CustomModuleSection,
  type CustomModuleSectionColumns,
  type CustomModuleTableBlock,
  type CustomModuleTone,
} from '@/lib/workspace-custom-layout'

type Notice = { tone: 'success' | 'error' | 'info'; message: string } | null

function cloneLayout(layout: CustomModuleLayout): CustomModuleLayout {
  return structuredClone(layout)
}

function errorText(raw: unknown) {
  if (raw instanceof Error) return raw.message
  return String(raw ?? 'Не удалось сохранить внутренний layout.')
}

function reorder<T>(items: T[], index: number, delta: -1 | 1) {
  const targetIndex = index + delta
  if (index < 0 || targetIndex < 0 || targetIndex >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(targetIndex, 0, item)
  return next
}

function noticeClass(notice: Notice) {
  if (!notice) return ''
  return `lab-builder-notice is-${notice.tone}`
}

function createKpiItem(): CustomModuleKpiBlock['items'][number] {
  return {
    id: `kpi-item-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 8)}`,
    label: 'Новая метрика',
    value: '0',
    note: 'без пояснения',
    tone: 'accent',
  }
}

function createFormField(): CustomModuleFormField {
  return {
    id: `field-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 8)}`,
    label: 'Новое поле',
    type: 'text',
    placeholder: '',
    required: false,
    options: [],
  }
}

function createActionButton(): CustomModuleActionButton {
  return {
    id: `action-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 8)}`,
    label: 'Новая команда',
    tone: 'secondary',
    hint: '',
    href: '',
  }
}

function blockCounter(layout: CustomModuleLayout) {
  return layout.sections.reduce((sum, section) => sum + section.blocks.length, 0)
}

function BuilderToneSelect({ value, onChange }: { value: CustomModuleTone; onChange: (value: CustomModuleTone) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.currentTarget.value as CustomModuleTone)}>
      {CUSTOM_MODULE_TONES.map((tone) => (
        <option key={tone} value={tone}>{tone}</option>
      ))}
    </select>
  )
}

function BuilderFieldTypeSelect({ value, onChange }: { value: CustomModuleFieldType; onChange: (value: CustomModuleFieldType) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.currentTarget.value as CustomModuleFieldType)}>
      {CUSTOM_MODULE_FIELD_TYPES.map((type) => (
        <option key={type} value={type}>{type}</option>
      ))}
    </select>
  )
}

function BuilderButtonToneSelect({ value, onChange }: { value: CustomModuleButtonTone; onChange: (value: CustomModuleButtonTone) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.currentTarget.value as CustomModuleButtonTone)}>
      {CUSTOM_MODULE_BUTTON_TONES.map((tone) => (
        <option key={tone} value={tone}>{tone}</option>
      ))}
    </select>
  )
}

function BlockEditorShell({
  section,
  block,
  index,
  onMove,
  onRemove,
  onUpdate,
  children,
}: {
  section: CustomModuleSection
  block: CustomModuleBlock
  index: number
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  onUpdate: (updater: (block: CustomModuleBlock) => void) => void
  children: ReactNode
}) {
  const maxSpan = section.columns
  const spanOptions = Array.from({ length: maxSpan }, (_, idx) => idx + 1)

  return (
    <div className="lab-builder-block-card">
      <div className="lab-builder-row between start">
        <div>
          <div className="lab-builder-code">block/{String(index + 1).padStart(2, '0')}</div>
          <h4 className="lab-builder-block-title">{getCustomModuleBlockLabel(block.type)}</h4>
        </div>
        <div className="lab-builder-inline-actions">
          <button type="button" className="lab-builder-button subtle" onClick={() => onMove(-1)} disabled={index === 0}>↑</button>
          <button type="button" className="lab-builder-button subtle" onClick={() => onMove(1)} disabled={index === section.blocks.length - 1}>↓</button>
          <button type="button" className="lab-builder-button danger" onClick={onRemove}>Удалить</button>
        </div>
      </div>

      <div className="lab-builder-grid two">
        <label>
          Заголовок
          <input value={block.title} onChange={(event) => onUpdate((draft) => { draft.title = event.currentTarget.value })} />
        </label>
        <label>
          Подзаголовок
          <input value={block.subtitle} onChange={(event) => onUpdate((draft) => { draft.subtitle = event.currentTarget.value })} />
        </label>
        <label>
          Span
          <select value={block.span} onChange={(event) => onUpdate((draft) => { draft.span = Number(event.currentTarget.value) })}>
            {spanOptions.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Tone
          <BuilderToneSelect value={block.tone} onChange={(value) => onUpdate((draft) => { draft.tone = value })} />
        </label>
      </div>

      {children}
    </div>
  )
}

function KpiBlockEditor({
  section,
  block,
  index,
  onMove,
  onRemove,
  onUpdate,
}: {
  section: CustomModuleSection
  block: CustomModuleKpiBlock
  index: number
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  onUpdate: (updater: (block: CustomModuleKpiBlock) => void) => void
}) {
  return (
    <BlockEditorShell section={section} block={block} index={index} onMove={onMove} onRemove={onRemove} onUpdate={(updater) => onUpdate((draft) => updater(draft as CustomModuleKpiBlock))}>
      <div className="lab-builder-subhead">Метрики</div>
      <div className="lab-builder-stack">
        {block.items.map((item, itemIndex) => (
          <div key={item.id} className="lab-builder-mini-card">
            <div className="lab-builder-row between start">
              <div className="lab-builder-code">kpi/{itemIndex + 1}</div>
              <button
                type="button"
                className="lab-builder-button subtle"
                onClick={() =>
                  onUpdate((draft) => {
                    draft.items = draft.items.filter((entry) => entry.id !== item.id)
                  })
                }
                disabled={block.items.length === 1}
              >
                ×
              </button>
            </div>
            <div className="lab-builder-grid two">
              <label>
                Label
                <input
                  value={item.label}
                  onChange={(event) =>
                    onUpdate((draft) => {
                      const target = draft.items.find((entry) => entry.id === item.id)
                      if (target) target.label = event.currentTarget.value
                    })
                  }
                />
              </label>
              <label>
                Value
                <input
                  value={item.value}
                  onChange={(event) =>
                    onUpdate((draft) => {
                      const target = draft.items.find((entry) => entry.id === item.id)
                      if (target) target.value = event.currentTarget.value
                    })
                  }
                />
              </label>
              <label>
                Note
                <input
                  value={item.note}
                  onChange={(event) =>
                    onUpdate((draft) => {
                      const target = draft.items.find((entry) => entry.id === item.id)
                      if (target) target.note = event.currentTarget.value
                    })
                  }
                />
              </label>
              <label>
                Tone
                <BuilderToneSelect
                  value={item.tone}
                  onChange={(value) =>
                    onUpdate((draft) => {
                      const target = draft.items.find((entry) => entry.id === item.id)
                      if (target) target.tone = value
                    })
                  }
                />
              </label>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="lab-builder-button secondary" onClick={() => onUpdate((draft) => { draft.items.push(createKpiItem()) })}>+ KPI</button>
    </BlockEditorShell>
  )
}

function TableBlockEditor({
  section,
  block,
  index,
  onMove,
  onRemove,
  onUpdate,
}: {
  section: CustomModuleSection
  block: CustomModuleTableBlock
  index: number
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  onUpdate: (updater: (block: CustomModuleTableBlock) => void) => void
}) {
  return (
    <BlockEditorShell section={section} block={block} index={index} onMove={onMove} onRemove={onRemove} onUpdate={(updater) => onUpdate((draft) => updater(draft as CustomModuleTableBlock))}>
      <div className="lab-builder-subhead">Колонки</div>
      <div className="lab-builder-stack compact">
        {block.columns.map((column, columnIndex) => (
          <div key={`${block.id}-column-${columnIndex}`} className="lab-builder-inline-edit">
            <input
              value={column}
              onChange={(event) =>
                onUpdate((draft) => {
                  draft.columns[columnIndex] = event.currentTarget.value
                })
              }
            />
            <button
              type="button"
              className="lab-builder-button subtle"
              onClick={() =>
                onUpdate((draft) => {
                  if (draft.columns.length <= 1) return
                  draft.columns.splice(columnIndex, 1)
                  draft.rows = draft.rows.map((row) => row.filter((_, cellIndex) => cellIndex !== columnIndex))
                })
              }
              disabled={block.columns.length <= 1}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="lab-builder-inline-actions">
        <button
          type="button"
          className="lab-builder-button secondary"
          onClick={() =>
            onUpdate((draft) => {
              draft.columns.push(`Колонка ${draft.columns.length + 1}`)
              draft.rows = draft.rows.map((row) => [...row, ''])
            })
          }
        >
          + Колонка
        </button>
        <label className="lab-builder-inline-check">
          <input type="checkbox" checked={block.dense} onChange={(event) => onUpdate((draft) => { draft.dense = event.currentTarget.checked })} />
          <span>Dense rows</span>
        </label>
      </div>

      <div className="lab-builder-subhead">Строки</div>
      <div className="lab-builder-stack">
        {block.rows.map((row, rowIndex) => (
          <div key={`${block.id}-row-${rowIndex}`} className="lab-builder-mini-card">
            <div className="lab-builder-row between start">
              <div className="lab-builder-code">row/{rowIndex + 1}</div>
              <button
                type="button"
                className="lab-builder-button subtle"
                onClick={() =>
                  onUpdate((draft) => {
                    draft.rows = draft.rows.filter((_, index) => index !== rowIndex)
                  })
                }
                disabled={block.rows.length === 1}
              >
                ×
              </button>
            </div>
            <div className="lab-builder-grid two">
              {row.map((cell, cellIndex) => (
                <label key={`${block.id}-row-${rowIndex}-cell-${cellIndex}`}>
                  {block.columns[cellIndex] || `Cell ${cellIndex + 1}`}
                  <input
                    value={cell}
                    onChange={(event) =>
                      onUpdate((draft) => {
                        draft.rows[rowIndex][cellIndex] = event.currentTarget.value
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="lab-builder-button secondary"
        onClick={() =>
          onUpdate((draft) => {
            draft.rows.push(Array.from({ length: draft.columns.length }, () => ''))
          })
        }
      >
        + Строка
      </button>
    </BlockEditorShell>
  )
}

function FormBlockEditor({
  section,
  block,
  index,
  onMove,
  onRemove,
  onUpdate,
}: {
  section: CustomModuleSection
  block: CustomModuleFormBlock
  index: number
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  onUpdate: (updater: (block: CustomModuleFormBlock) => void) => void
}) {
  return (
    <BlockEditorShell section={section} block={block} index={index} onMove={onMove} onRemove={onRemove} onUpdate={(updater) => onUpdate((draft) => updater(draft as CustomModuleFormBlock))}>
      <div className="lab-builder-grid two">
        <label>
          Primary CTA
          <input value={block.submitLabel} onChange={(event) => onUpdate((draft) => { draft.submitLabel = event.currentTarget.value })} />
        </label>
        <label>
          Secondary CTA
          <input value={block.secondaryLabel} onChange={(event) => onUpdate((draft) => { draft.secondaryLabel = event.currentTarget.value })} />
        </label>
      </div>

      <div className="lab-builder-subhead">Поля</div>
      <div className="lab-builder-stack">
        {block.fields.map((field, fieldIndex) => (
          <div key={field.id} className="lab-builder-mini-card">
            <div className="lab-builder-row between start">
              <div className="lab-builder-code">field/{fieldIndex + 1}</div>
              <button
                type="button"
                className="lab-builder-button subtle"
                onClick={() =>
                  onUpdate((draft) => {
                    draft.fields = draft.fields.filter((entry) => entry.id !== field.id)
                  })
                }
                disabled={block.fields.length === 1}
              >
                ×
              </button>
            </div>
            <div className="lab-builder-grid two">
              <label>
                Label
                <input
                  value={field.label}
                  onChange={(event) =>
                    onUpdate((draft) => {
                      const target = draft.fields.find((entry) => entry.id === field.id)
                      if (target) target.label = event.currentTarget.value
                    })
                  }
                />
              </label>
              <label>
                Type
                <BuilderFieldTypeSelect
                  value={field.type}
                  onChange={(value) =>
                    onUpdate((draft) => {
                      const target = draft.fields.find((entry) => entry.id === field.id)
                      if (target) target.type = value
                    })
                  }
                />
              </label>
              <label>
                Placeholder
                <input
                  value={field.placeholder}
                  onChange={(event) =>
                    onUpdate((draft) => {
                      const target = draft.fields.find((entry) => entry.id === field.id)
                      if (target) target.placeholder = event.currentTarget.value
                    })
                  }
                />
              </label>
              <label>
                Options (через ;)
                <input
                  value={field.options.join('; ')}
                  onChange={(event) =>
                    onUpdate((draft) => {
                      const target = draft.fields.find((entry) => entry.id === field.id)
                      if (target) {
                        target.options = event.currentTarget.value
                          .split(';')
                          .map((item) => item.trim())
                          .filter(Boolean)
                      }
                    })
                  }
                />
              </label>
            </div>
            <label className="lab-builder-inline-check">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(event) =>
                  onUpdate((draft) => {
                    const target = draft.fields.find((entry) => entry.id === field.id)
                    if (target) target.required = event.currentTarget.checked
                  })
                }
              />
              <span>Обязательное поле</span>
            </label>
          </div>
        ))}
      </div>
      <button type="button" className="lab-builder-button secondary" onClick={() => onUpdate((draft) => { draft.fields.push(createFormField()) })}>+ Поле</button>
    </BlockEditorShell>
  )
}

function ActionsBlockEditor({
  section,
  block,
  index,
  onMove,
  onRemove,
  onUpdate,
}: {
  section: CustomModuleSection
  block: CustomModuleActionsBlock
  index: number
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  onUpdate: (updater: (block: CustomModuleActionsBlock) => void) => void
}) {
  return (
    <BlockEditorShell section={section} block={block} index={index} onMove={onMove} onRemove={onRemove} onUpdate={(updater) => onUpdate((draft) => updater(draft as CustomModuleActionsBlock))}>
      <div className="lab-builder-subhead">Команды</div>
      <div className="lab-builder-stack">
        {block.buttons.map((button, buttonIndex) => (
          <div key={button.id} className="lab-builder-mini-card">
            <div className="lab-builder-row between start">
              <div className="lab-builder-code">cmd/{buttonIndex + 1}</div>
              <button
                type="button"
                className="lab-builder-button subtle"
                onClick={() =>
                  onUpdate((draft) => {
                    draft.buttons = draft.buttons.filter((entry) => entry.id !== button.id)
                  })
                }
                disabled={block.buttons.length === 1}
              >
                ×
              </button>
            </div>
            <div className="lab-builder-grid two">
              <label>
                Label
                <input
                  value={button.label}
                  onChange={(event) =>
                    onUpdate((draft) => {
                      const target = draft.buttons.find((entry) => entry.id === button.id)
                      if (target) target.label = event.currentTarget.value
                    })
                  }
                />
              </label>
              <label>
                Tone
                <BuilderButtonToneSelect
                  value={button.tone}
                  onChange={(value) =>
                    onUpdate((draft) => {
                      const target = draft.buttons.find((entry) => entry.id === button.id)
                      if (target) target.tone = value
                    })
                  }
                />
              </label>
              <label>
                Hint
                <input
                  value={button.hint}
                  onChange={(event) =>
                    onUpdate((draft) => {
                      const target = draft.buttons.find((entry) => entry.id === button.id)
                      if (target) target.hint = event.currentTarget.value
                    })
                  }
                />
              </label>
              <label>
                Href
                <input
                  value={button.href}
                  onChange={(event) =>
                    onUpdate((draft) => {
                      const target = draft.buttons.find((entry) => entry.id === button.id)
                      if (target) target.href = event.currentTarget.value
                    })
                  }
                />
              </label>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="lab-builder-button secondary" onClick={() => onUpdate((draft) => { draft.buttons.push(createActionButton()) })}>+ Команда</button>
    </BlockEditorShell>
  )
}

function BlockEditor({
  section,
  block,
  index,
  onMove,
  onRemove,
  onUpdate,
}: {
  section: CustomModuleSection
  block: CustomModuleBlock
  index: number
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  onUpdate: (updater: (block: CustomModuleBlock) => void) => void
}) {
  switch (block.type) {
    case 'kpi':
      return <KpiBlockEditor section={section} block={block} index={index} onMove={onMove} onRemove={onRemove} onUpdate={(updater) => onUpdate((draft) => updater(draft as CustomModuleKpiBlock))} />
    case 'table':
      return <TableBlockEditor section={section} block={block} index={index} onMove={onMove} onRemove={onRemove} onUpdate={(updater) => onUpdate((draft) => updater(draft as CustomModuleTableBlock))} />
    case 'form':
      return <FormBlockEditor section={section} block={block} index={index} onMove={onMove} onRemove={onRemove} onUpdate={(updater) => onUpdate((draft) => updater(draft as CustomModuleFormBlock))} />
    case 'actions':
      return <ActionsBlockEditor section={section} block={block} index={index} onMove={onMove} onRemove={onRemove} onUpdate={(updater) => onUpdate((draft) => updater(draft as CustomModuleActionsBlock))} />
  }
}

export function CustomModuleBuilder({ module, canEdit }: { module: WorkspaceCustomModuleScreen; canEdit: boolean }) {
  const [layout, setLayout] = useState<CustomModuleLayout>(module.metadata)
  const [savedLayout, setSavedLayout] = useState<CustomModuleLayout>(module.metadata)
  const [notice, setNotice] = useState<Notice>(null)
  const [saving, setSaving] = useState(false)

  const dirty = useMemo(() => JSON.stringify(layout) !== JSON.stringify(savedLayout), [layout, savedLayout])
  const previewModule = useMemo<WorkspaceCustomModuleScreen>(() => ({ ...module, metadata: layout }), [layout, module])

  const changeLayout = (updater: (draft: CustomModuleLayout) => void) => {
    setLayout((current) => {
      const draft = cloneLayout(current)
      updater(draft)
      return normalizeCustomModuleLayout({
        title: module.label,
        description: module.description,
        route: module.href,
        metadata: draft,
      })
    })
  }

  const updateSection = (sectionId: string, updater: (section: CustomModuleSection) => void) => {
    changeLayout((draft) => {
      const section = draft.sections.find((entry) => entry.id === sectionId)
      if (section) updater(section)
    })
  }

  const updateBlock = (sectionId: string, blockId: string, updater: (block: CustomModuleBlock) => void) => {
    updateSection(sectionId, (section) => {
      const block = section.blocks.find((entry) => entry.id === blockId)
      if (block) updater(block)
    })
  }

  const handleSave = async () => {
    if (!canEdit || !module.source_id) return
    setSaving(true)
    setNotice({ tone: 'info', message: 'Сохраняю layout v19…' })

    try {
      const response = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-custom-module-layout', moduleId: module.source_id, metadata: layout }),
      })

      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Не удалось сохранить внутренний layout.')
      }

      const normalized = normalizeCustomModuleLayout({
        title: module.label,
        description: module.description,
        route: module.href,
        metadata: layout,
      })

      setLayout(normalized)
      setSavedLayout(normalized)
      setNotice({ tone: 'success', message: 'v19 сохранён. Внутренний конструктор раздела обновлён.' })
    } catch (error) {
      setNotice({ tone: 'error', message: errorText(error) })
    } finally {
      setSaving(false)
    }
  }

  const resetToTemplate = () => {
    const template = createDefaultCustomModuleLayout({
      title: module.label,
      description: module.description,
      route: module.href,
    })
    setLayout(template)
    setNotice({ tone: 'info', message: 'Шаблон v19 загружен в редактор. Сохрани, если хочешь зафиксировать.' })
  }

  const resetToSaved = () => {
    setLayout(savedLayout)
    setNotice({ tone: 'info', message: 'Локальные правки откатил к последнему сохранению.' })
  }

  if (!canEdit) {
    return (
      <div className="content-stack">
        <section className="card stack">
          <div className="badge-row">
            <span className="badge">Свой раздел</span>
            <span className="badge">runtime only</span>
          </div>
          <div className="micro">Этот экран уже собран как внутренний runtime модуля. Редактирование доступно администраторам.</div>
        </section>
        <CustomModuleScreen module={module} />
      </div>
    )
  }

  return (
    <div className="content-stack">
      <section className="card lab-builder-shell">
        <div className="lab-builder-hero">
          <div>
            <div className="lab-builder-code">v19 / internal section builder</div>
            <h1 className="page-title" style={{ marginBottom: 10 }}>{module.label}</h1>
            <div className="lab-builder-copy">
              Теперь это уже не пустой кастомный модуль, а настоящий внутренний конструктор раздела: секции, span-логика, KPI, таблицы, формы и команды.
            </div>
          </div>
          <div className="lab-builder-top-actions">
            <button type="button" className="button-secondary" onClick={resetToTemplate}>Каркас v19</button>
            <button type="button" className="button-secondary" onClick={resetToSaved} disabled={!dirty}>Откатить</button>
            <button type="button" className="button" onClick={handleSave} disabled={saving || !dirty}>{saving ? 'Сохраняю…' : 'Сохранить layout'}</button>
          </div>
        </div>

        <div className="lab-builder-meta">
          <div className="lab-builder-meta-card">
            <span>route</span>
            <strong>{module.href}</strong>
          </div>
          <div className="lab-builder-meta-card">
            <span>sections</span>
            <strong>{layout.sections.length}</strong>
          </div>
          <div className="lab-builder-meta-card">
            <span>blocks</span>
            <strong>{blockCounter(layout)}</strong>
          </div>
          <div className="lab-builder-meta-card">
            <span>state</span>
            <strong>{dirty ? 'unsaved' : 'synced'}</strong>
          </div>
        </div>

        {notice ? <div className={noticeClass(notice)}>{notice.message}</div> : null}

        <div className="lab-builder-workbench">
          <aside className="lab-builder-pane">
            <div className="lab-builder-panel">
              <div className="lab-builder-panel-title">Общий каркас</div>
              <div className="lab-builder-grid two">
                <label>
                  Eyebrow
                  <input value={layout.eyebrow} onChange={(event) => changeLayout((draft) => { draft.eyebrow = event.currentTarget.value })} />
                </label>
                <label>
                  Status line
                  <input value={layout.statusLine} onChange={(event) => changeLayout((draft) => { draft.statusLine = event.currentTarget.value })} />
                </label>
              </div>
              <label>
                Summary
                <textarea value={layout.summary} onChange={(event) => changeLayout((draft) => { draft.summary = event.currentTarget.value })} rows={4} />
              </label>
            </div>

            <div className="lab-builder-panel">
              <div className="lab-builder-row between start">
                <div>
                  <div className="lab-builder-panel-title">Секции</div>
                  <div className="micro">Колонки секции определяют внутренний layout. У каждого блока есть span.</div>
                </div>
                <button
                  type="button"
                  className="lab-builder-button secondary"
                  onClick={() => changeLayout((draft) => { draft.sections.push(createDefaultCustomModuleSection(draft.sections.length + 1)) })}
                >
                  + Секция
                </button>
              </div>

              <div className="lab-builder-stack">
                {layout.sections.map((section, sectionIndex) => (
                  <div key={section.id} className="lab-builder-section-card">
                    <div className="lab-builder-row between start">
                      <div>
                        <div className="lab-builder-code">section/{String(sectionIndex + 1).padStart(2, '0')}</div>
                        <h3 className="lab-builder-section-title">{section.title}</h3>
                      </div>
                      <div className="lab-builder-inline-actions">
                        <button type="button" className="lab-builder-button subtle" onClick={() => changeLayout((draft) => { draft.sections = reorder(draft.sections, sectionIndex, -1) })} disabled={sectionIndex === 0}>↑</button>
                        <button type="button" className="lab-builder-button subtle" onClick={() => changeLayout((draft) => { draft.sections = reorder(draft.sections, sectionIndex, 1) })} disabled={sectionIndex === layout.sections.length - 1}>↓</button>
                        <button
                          type="button"
                          className="lab-builder-button danger"
                          onClick={() =>
                            changeLayout((draft) => {
                              if (draft.sections.length <= 1) return
                              draft.sections = draft.sections.filter((entry) => entry.id !== section.id)
                            })
                          }
                          disabled={layout.sections.length <= 1}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>

                    <div className="lab-builder-grid two">
                      <label>
                        Заголовок
                        <input value={section.title} onChange={(event) => updateSection(section.id, (draft) => { draft.title = event.currentTarget.value })} />
                      </label>
                      <label>
                        Колонки
                        <select
                          value={section.columns}
                          onChange={(event) =>
                            updateSection(section.id, (draft) => {
                              const nextColumns = Number(event.currentTarget.value) as CustomModuleSectionColumns
                              draft.columns = nextColumns
                              draft.blocks.forEach((block) => {
                                block.span = Math.min(block.span, nextColumns)
                              })
                            })
                          }
                        >
                          {CUSTOM_MODULE_SECTION_COLUMNS.map((columns) => (
                            <option key={columns} value={columns}>{columns}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      Описание
                      <textarea value={section.description} onChange={(event) => updateSection(section.id, (draft) => { draft.description = event.currentTarget.value })} rows={3} />
                    </label>

                    <div className="lab-builder-adders">
                      {CUSTOM_MODULE_BLOCK_TYPES.map((type) => (
                        <button
                          key={`${section.id}-${type}`}
                          type="button"
                          className="lab-builder-button secondary"
                          onClick={() =>
                            updateSection(section.id, (draft) => {
                              draft.blocks.push(createDefaultCustomModuleBlock(type, draft.columns))
                            })
                          }
                        >
                          + {getCustomModuleBlockLabel(type)}
                        </button>
                      ))}
                    </div>

                    <div className="lab-builder-stack">
                      {section.blocks.map((block, blockIndex) => (
                        <BlockEditor
                          key={block.id}
                          section={section}
                          block={block}
                          index={blockIndex}
                          onMove={(direction) =>
                            updateSection(section.id, (draft) => {
                              const currentIndex = draft.blocks.findIndex((entry) => entry.id === block.id)
                              if (currentIndex === -1) return
                              draft.blocks = reorder(draft.blocks, currentIndex, direction)
                            })
                          }
                          onRemove={() =>
                            updateSection(section.id, (draft) => {
                              if (draft.blocks.length <= 1) return
                              draft.blocks = draft.blocks.filter((entry) => entry.id !== block.id)
                            })
                          }
                          onUpdate={(updater) => updateBlock(section.id, block.id, updater)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="lab-preview-pane">
            <div className="lab-preview-header">
              <div>
                <div className="lab-builder-code">runtime preview</div>
                <h2 className="lab-preview-title">TsLAB-плотность для внутреннего экрана</h2>
                <div className="micro">Слева ты собираешь структуру. Справа сразу видишь итоговый экран раздела.</div>
              </div>
            </div>
            <CustomModuleScreen module={previewModule} preview />
          </div>
        </div>
      </section>
    </div>
  )
}
