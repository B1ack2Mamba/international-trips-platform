import type { WorkspaceCustomModuleScreen } from '@/lib/influence-spaces'
import {
  getCustomModuleBlockLabel,
  type CustomModuleActionsBlock,
  type CustomModuleBlock,
  type CustomModuleFieldType,
  type CustomModuleFormBlock,
  type CustomModuleFormField,
  type CustomModuleKpiBlock,
  type CustomModuleTableBlock,
  type CustomModuleTone,
} from '@/lib/workspace-custom-layout'

const TONE_CLASS: Record<CustomModuleTone, string> = {
  accent: 'is-tone-accent',
  success: 'is-tone-success',
  warning: 'is-tone-warning',
  danger: 'is-tone-danger',
  neutral: 'is-tone-neutral',
}

function renderFieldControl(field: CustomModuleFormField) {
  const commonProps = {
    className: 'lab-runtime-input',
    placeholder: field.placeholder,
    'aria-label': field.label,
  }

  switch (field.type as CustomModuleFieldType) {
    case 'textarea':
      return <textarea {...commonProps} rows={4} defaultValue="" />
    case 'select':
      return (
        <select className="lab-runtime-input" aria-label={field.label} defaultValue="">
          <option value="">{field.placeholder || 'Выбери значение'}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      )
    case 'toggle':
      return (
        <label className="lab-runtime-toggle">
          <input type="checkbox" />
          <span>{field.placeholder || 'Переключатель'}</span>
        </label>
      )
    case 'date':
      return <input {...commonProps} type="date" />
    case 'number':
      return <input {...commonProps} type="number" />
    default:
      return <input {...commonProps} type="text" />
  }
}

function renderKpiBlock(block: CustomModuleKpiBlock) {
  return (
    <div className="lab-kpi-grid">
      {block.items.map((item) => (
        <div key={item.id} className={`lab-kpi-card ${TONE_CLASS[item.tone]}`}>
          <div className="lab-kpi-label">{item.label}</div>
          <div className="lab-kpi-value">{item.value}</div>
          <div className="lab-kpi-note">{item.note}</div>
        </div>
      ))}
    </div>
  )
}

function renderTableBlock(block: CustomModuleTableBlock) {
  return (
    <div className={`lab-table-wrap${block.dense ? ' is-dense' : ''}`}>
      <table className="lab-table">
        <thead>
          <tr>
            {block.columns.map((column, index) => (
              <th key={`${block.id}-${index}`}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={`${block.id}-row-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${block.id}-row-${rowIndex}-cell-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function renderFormBlock(block: CustomModuleFormBlock) {
  return (
    <div className="lab-form-stack">
      <div className="lab-form-grid">
        {block.fields.map((field) => (
          <div key={field.id} className={`lab-form-field${field.type === 'textarea' ? ' is-wide' : ''}${field.type === 'toggle' ? ' is-toggle' : ''}`}>
            <div className="lab-form-label-row">
              <div className="lab-form-label">{field.label}</div>
              {field.required ? <span className="lab-required-mark">required</span> : null}
            </div>
            {renderFieldControl(field)}
          </div>
        ))}
      </div>
      <div className="lab-command-row">
        <button type="button" className="lab-command primary">{block.submitLabel}</button>
        {block.secondaryLabel ? <button type="button" className="lab-command secondary">{block.secondaryLabel}</button> : null}
      </div>
    </div>
  )
}

function renderActionsBlock(block: CustomModuleActionsBlock) {
  return (
    <div className="lab-actions-stack">
      {block.buttons.map((button) => {
        const className = `lab-command ${button.tone}`
        return button.href ? (
          <a key={button.id} href={button.href} className={className}>
            <span>{button.label}</span>
            {button.hint ? <small>{button.hint}</small> : null}
          </a>
        ) : (
          <button key={button.id} type="button" className={className}>
            <span>{button.label}</span>
            {button.hint ? <small>{button.hint}</small> : null}
          </button>
        )
      })}
    </div>
  )
}

function renderBlockContent(block: CustomModuleBlock) {
  switch (block.type) {
    case 'kpi':
      return renderKpiBlock(block)
    case 'table':
      return renderTableBlock(block)
    case 'form':
      return renderFormBlock(block)
    case 'actions':
      return renderActionsBlock(block)
  }
}

export function CustomModuleScreen({ module, preview = false }: { module: WorkspaceCustomModuleScreen; preview?: boolean }) {
  const layout = module.metadata
  const totalBlocks = layout.sections.reduce((sum, section) => sum + section.blocks.length, 0)
  const totalFields = layout.sections.reduce(
    (sum, section) =>
      sum + section.blocks.reduce((blockSum, block) => blockSum + (block.type === 'form' ? block.fields.length : 0), 0),
    0,
  )
  const totalCommands = layout.sections.reduce(
    (sum, section) =>
      sum + section.blocks.reduce((blockSum, block) => blockSum + (block.type === 'actions' ? block.buttons.length : 0), 0),
    0,
  )

  return (
    <section className={`lab-screen-shell${preview ? ' is-preview' : ''}`}>
      <div className="lab-screen-topline">
        <div className="lab-screen-chip-row">
          <span className="lab-screen-chip">{layout.eyebrow}</span>
          <span className="lab-screen-chip muted">{module.href}</span>
          <span className="lab-screen-chip muted">v{layout.version}</span>
        </div>
        <div className="lab-screen-status">{layout.statusLine}</div>
      </div>

      <div className="lab-screen-header">
        <div className="lab-screen-heading">
          <div className="lab-screen-kicker">custom.runtime</div>
          <h1 className="lab-screen-title">{module.label}</h1>
          <div className="lab-screen-summary">{layout.summary || module.description}</div>
        </div>
        <div className="lab-screen-stats">
          <div className="lab-screen-stat">
            <span>sections</span>
            <strong>{layout.sections.length}</strong>
          </div>
          <div className="lab-screen-stat">
            <span>blocks</span>
            <strong>{totalBlocks}</strong>
          </div>
          <div className="lab-screen-stat">
            <span>fields</span>
            <strong>{totalFields}</strong>
          </div>
          <div className="lab-screen-stat">
            <span>commands</span>
            <strong>{totalCommands}</strong>
          </div>
        </div>
      </div>

      <div className="lab-screen-toolbar">
        <button type="button" className="lab-toolbar-button active">monitor</button>
        <button type="button" className="lab-toolbar-button">grid</button>
        <button type="button" className="lab-toolbar-button">forms</button>
        <button type="button" className="lab-toolbar-button">actions</button>
      </div>

      <div className="lab-screen-sections">
        {layout.sections.map((section, sectionIndex) => (
          <section key={section.id} className="lab-section-shell">
            <div className="lab-section-header">
              <div>
                <div className="lab-section-kicker">section/{String(sectionIndex + 1).padStart(2, '0')}</div>
                <h2 className="lab-section-title">{section.title}</h2>
                <div className="lab-section-description">{section.description}</div>
              </div>
              <div className="lab-section-meta">{section.columns} col · {section.blocks.length} block</div>
            </div>

            <div className="lab-section-grid" style={{ gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))` }}>
              {section.blocks.map((block) => {
                const blockSpan = Math.min(block.span, section.columns)
                return (
                  <article
                    key={block.id}
                    className={`lab-panel ${TONE_CLASS[block.tone]}`}
                    style={{ gridColumn: `span ${blockSpan} / span ${blockSpan}` }}
                  >
                    <div className="lab-panel-header">
                      <div>
                        <div className="lab-panel-type">{getCustomModuleBlockLabel(block.type)}</div>
                        <h3 className="lab-panel-title">{block.title}</h3>
                        <div className="lab-panel-subtitle">{block.subtitle}</div>
                      </div>
                      <div className="lab-panel-tag">span {blockSpan}</div>
                    </div>
                    <div className="lab-panel-body">{renderBlockContent(block)}</div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
