'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react'
import type {
  WorkspaceBuilderData,
  WorkspaceGraphNode,
  WorkspaceModuleDefinition,
  WorkspaceModuleKey,
} from '@/lib/influence-spaces'

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

function errorMessage(raw: unknown) {
  const value = raw instanceof Error ? raw.message : String(raw ?? '')
  switch (value) {
    case 'invalid_graph_link':
      return 'Связь не создана. Нужны два разных раздела.'
    case 'unknown_module_key':
      return 'Раздел не найден в каталоге.'
    default:
      return value || 'Не удалось сохранить карту связей.'
  }
}

type LineGeometry = {
  id: string
  d: string
  midX: number
  midY: number
}

type LocalNodeLayoutMap = Record<string, { x: number; y: number }>

type StageNodeProps = {
  node: WorkspaceGraphNode
  layout: { x: number; y: number }
  onPointerDown: (node: WorkspaceGraphNode, event: ReactPointerEvent<HTMLDivElement>) => void
  onStartLink: (moduleKey: WorkspaceModuleKey, event: ReactPointerEvent<HTMLButtonElement>) => void
  onRemove: (moduleKey: WorkspaceModuleKey) => void
  registerNode: (key: string, node: HTMLDivElement | null) => void
}

function StageNode({ node, layout, onPointerDown, onStartLink, onRemove, registerNode }: StageNodeProps) {
  return (
    <div
      ref={(element) => registerNode(String(node.key), element)}
      className={`constructor-node${node.module.kind === 'custom' ? ' is-custom' : ''}`}
      data-graph-module-key={node.key}
      style={{ left: layout.x, top: layout.y, width: 188 }}
    >
      <div className="constructor-node-card" onPointerDown={(event) => onPointerDown(node, event)}>
        <div className="constructor-node-copy">
          <div className="constructor-node-label-row">
            <span className="constructor-node-title">{node.module.label}</span>
            {node.module.kind === 'custom' ? <span className="constructor-node-badge">свой</span> : null}
          </div>
          <div className="constructor-node-route">{node.module.href}</div>
        </div>
        <div className="constructor-node-tools">
          <button
            type="button"
            className="constructor-node-tool"
            onPointerDown={(event) => {
              event.stopPropagation()
              onStartLink(node.key, event)
            }}
            title="Потянуть визуальную связь"
          >
            ●
          </button>
          <a
            href={node.module.href}
            className="constructor-node-tool"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            title="Открыть раздел"
          >
            ↗
          </a>
          <button
            type="button"
            className="constructor-node-tool danger"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onRemove(node.key)
            }}
            title="Убрать раздел с карты связей"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

export function WorkspaceConnectionsBuilder({ initialData }: { initialData: WorkspaceBuilderData }) {
  const [data, setData] = useState<WorkspaceBuilderData>(initialData)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [paletteDragging, setPaletteDragging] = useState<WorkspaceModuleKey | null>(null)
  const [nodeDrafts, setNodeDrafts] = useState<LocalNodeLayoutMap>({})
  const [libraryCollapsed, setLibraryCollapsed] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [linkDraft, setLinkDraft] = useState<{
    fromModuleKey: WorkspaceModuleKey
    x: number
    y: number
    currentX: number
    currentY: number
  } | null>(null)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [measureTick, setMeasureTick] = useState(0)

  const builtinCatalog = useMemo(() => data.catalog.filter((module) => module.kind === 'builtin'), [data.catalog])
  const customCatalog = useMemo(() => data.catalog.filter((module) => module.kind === 'custom'), [data.catalog])

  const resolvedNodeLayout = useCallback(
    (node: WorkspaceGraphNode) => nodeDrafts[String(node.key)] ?? node.layout,
    [nodeDrafts],
  )

  const boardMetrics = useMemo(() => {
    const width = Math.max(data.graphBoard.width, ...data.graphNodes.map((node) => resolvedNodeLayout(node).x + 320))
    const height = Math.max(data.graphBoard.height, ...data.graphNodes.map((node) => resolvedNodeLayout(node).y + 220))
    return { width, height }
  }, [data.graphBoard.height, data.graphBoard.width, data.graphNodes, resolvedNodeLayout])

  const refreshGeometry = useCallback(() => {
    setMeasureTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(refreshGeometry)
    return () => cancelAnimationFrame(frame)
  }, [data, nodeDrafts, refreshGeometry])

  useEffect(() => {
    const onResize = () => refreshGeometry()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [refreshGeometry])

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
      refreshGeometry()
    }

    syncFullscreen()
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen)
    }
  }, [refreshGeometry])

  const lines = useMemo<LineGeometry[]>(() => {
    if (!stageRef.current) return []
    const stageBox = stageRef.current.getBoundingClientRect()

    return data.graphLinks
      .map((link) => {
        const fromNode = nodeRefs.current[String(link.from_module_key)]
        const toNode = nodeRefs.current[String(link.to_module_key)]
        if (!fromNode || !toNode) return null

        const from = fromNode.getBoundingClientRect()
        const to = toNode.getBoundingClientRect()
        const x1 = from.right - stageBox.left
        const y1 = from.top + from.height / 2 - stageBox.top
        const x2 = to.left - stageBox.left
        const y2 = to.top + to.height / 2 - stageBox.top
        const curve = Math.max(56, Math.abs(x2 - x1) * 0.35)
        const d = `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`
        return {
          id: link.id,
          d,
          midX: (x1 + x2) / 2,
          midY: (y1 + y2) / 2,
        }
      })
      .filter((line): line is LineGeometry => Boolean(line))
  }, [data.graphLinks, data.graphNodes, measureTick])

  async function mutate(action: Record<string, unknown>) {
    setPending(true)
    setNotice(null)
    try {
      const response = await fetch('/api/dashboard/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      })
      const json = (await response.json()) as { ok?: boolean; error?: string; data?: WorkspaceBuilderData }
      if (!response.ok || !json.ok || !json.data) {
        throw new Error(json.error ?? 'save_failed')
      }
      setData(json.data)
      setNodeDrafts({})
      refreshGeometry()
    } catch (error) {
      setNotice(errorMessage(error))
      setNodeDrafts({})
    } finally {
      setPending(false)
    }
  }

  const handleCreateCustomModule = useCallback(async () => {
    const label = window.prompt('Название нового раздела', 'Новый раздел')
    if (label === null) return
    const trimmedLabel = label.trim()
    if (!trimmedLabel) return
    const suggestedSlug = slugify(trimmedLabel) || 'new-section'
    const slug = window.prompt('Маршрут раздела (slug)', suggestedSlug)
    if (slug === null) return
    const trimmedSlug = slugify(slug)
    if (!trimmedSlug) return
    await mutate({ action: 'create-custom-module', label: trimmedLabel, slug: trimmedSlug })
  }, [])

  const handleEditCustomModule = useCallback(async (module: WorkspaceModuleDefinition) => {
    if (!module.editable || !module.source_id) return
    const label = window.prompt('Новое название раздела', module.label)
    if (label === null) return
    const trimmedLabel = label.trim()
    if (!trimmedLabel) return
    const currentSlug = module.href.split('/').pop() || 'section'
    const slug = window.prompt('Новый маршрут (slug)', currentSlug)
    if (slug === null) return
    const trimmedSlug = slugify(slug)
    if (!trimmedSlug) return
    await mutate({ action: 'update-custom-module', moduleId: module.source_id, label: trimmedLabel, slug: trimmedSlug })
  }, [])

  const handleDeleteCustomModule = useCallback(async (module: WorkspaceModuleDefinition) => {
    if (!module.editable || !module.source_id) return
    if (!window.confirm(`Удалить раздел «${module.label}» из каталога целиком?`)) return
    await mutate({ action: 'delete-custom-module', moduleId: module.source_id })
  }, [])

  const handleSeed = useCallback(async () => {
    await mutate({ action: 'seed-graph' })
  }, [])

  const handleToggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await document.documentElement.requestFullscreen()
  }, [])

  const registerNode = useCallback((id: string, node: HTMLDivElement | null) => {
    nodeRefs.current[id] = node
  }, [])

  const handleAddNode = useCallback(async (moduleKey: WorkspaceModuleKey, x: number, y: number) => {
    await mutate({
      action: 'graph-add-node',
      moduleKey,
      x: Math.max(24, Math.round(x)),
      y: Math.max(24, Math.round(y)),
    })
    setPaletteDragging(null)
  }, [])

  const handleStageDrop = useCallback(
    async (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const stage = stageRef.current
      if (!stage) return
      const rect = stage.getBoundingClientRect()
      const moduleKey = (event.dataTransfer.getData('text/workspace-module') || event.dataTransfer.getData('text/plain')) as WorkspaceModuleKey
      const x = event.clientX - rect.left - 94
      const y = event.clientY - rect.top - 26
      if (!moduleKey && !paletteDragging) return
      await handleAddNode(moduleKey || paletteDragging!, x, y)
    },
    [handleAddNode, paletteDragging],
  )

  const handleNodePointerDown = useCallback(
    (node: WorkspaceGraphNode, event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      const target = event.target as HTMLElement
      if (target.closest('button,a,input')) return
      event.preventDefault()

      const stage = stageRef.current
      if (!stage) return
      const card = event.currentTarget.parentElement as HTMLDivElement | null
      if (!card) return

      const stageBox = stage.getBoundingClientRect()
      const nodeRect = card.getBoundingClientRect()
      const offsetX = event.clientX - nodeRect.left
      const offsetY = event.clientY - nodeRect.top
      const initial = resolvedNodeLayout(node)

      const computeDraft = (clientX: number, clientY: number) => ({
        x: clamp(clientX - stageBox.left - offsetX, 12, Math.max(12, boardMetrics.width - nodeRect.width - 12)),
        y: clamp(clientY - stageBox.top - offsetY, 12, Math.max(12, boardMetrics.height - nodeRect.height - 12)),
      })

      const move = (pointerEvent: PointerEvent) => {
        const draft = computeDraft(pointerEvent.clientX, pointerEvent.clientY)
        setNodeDrafts((current) => ({
          ...current,
          [String(node.key)]: draft,
        }))
      }

      const up = async (pointerEvent: PointerEvent) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        const draft = computeDraft(pointerEvent.clientX, pointerEvent.clientY) ?? initial
        setNodeDrafts((current) => ({
          ...current,
          [String(node.key)]: draft,
        }))
        await mutate({
          action: 'graph-move-node',
          moduleKey: node.key,
          x: Math.round(draft.x),
          y: Math.round(draft.y),
        })
      }

      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [boardMetrics.height, boardMetrics.width, resolvedNodeLayout],
  )

  const handleStartLink = useCallback((moduleKey: WorkspaceModuleKey, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const stage = stageRef.current
    if (!stage) return
    const stageBox = stage.getBoundingClientRect()
    const x = event.clientX - stageBox.left
    const y = event.clientY - stageBox.top
    setLinkDraft({ fromModuleKey: moduleKey, x, y, currentX: x, currentY: y })

    const move = (pointerEvent: PointerEvent) => {
      const nextStage = stageRef.current
      if (!nextStage) return
      const nextBox = nextStage.getBoundingClientRect()
      setLinkDraft((draft) =>
        draft
          ? {
              ...draft,
              currentX: pointerEvent.clientX - nextBox.left,
              currentY: pointerEvent.clientY - nextBox.top,
            }
          : null,
      )
    }

    const up = async (pointerEvent: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const target = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)?.closest('[data-graph-module-key]')
      const targetKey = (target?.getAttribute('data-graph-module-key') ?? null) as WorkspaceModuleKey | null
      setLinkDraft(null)
      if (!targetKey || targetKey === moduleKey) return
      await mutate({ action: 'graph-create-link', fromModuleKey: moduleKey, toModuleKey: targetKey })
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [])

  const handleRemoveNode = useCallback(async (moduleKey: WorkspaceModuleKey) => {
    await mutate({ action: 'graph-remove-node', moduleKey })
  }, [])

  const graphKeys = useMemo(() => new Set(data.graphNodes.map((node) => String(node.key))), [data.graphNodes])

  return (
    <section className="card constructor-shell">
      <div className="constructor-topbar">
        <div>
          <div className="constructor-kicker">builder studio / graph</div>
          <h1 className="page-title" style={{ marginBottom: 6 }}>Карта связей между разделами</h1>
          <div className="micro">
            Отдельное окно без зон. Здесь только разделы и визуальные связи между ними. Раскладка по зонам осталась в соседнем окне.
          </div>
        </div>
        <div className="constructor-topbar-actions">
          <a href="/dashboard" className="button-secondary">← Панель</a>
          <a href="/dashboard/spaces" className="button-secondary">Зоны доступа</a>
          <button type="button" className="button-secondary" disabled>Карта связей</button>
          <button type="button" className="button-secondary" onClick={() => setLibraryCollapsed((value) => !value)}>
            {libraryCollapsed ? 'Показать библиотеку' : 'Скрыть библиотеку'}
          </button>
          <button type="button" className="button-secondary" onClick={handleToggleFullscreen}>
            {isFullscreen ? 'Окно' : 'Во весь экран'}
          </button>
          <button type="button" className="button-secondary" onClick={handleSeed}>Старт</button>
          <button type="button" className="button" onClick={handleCreateCustomModule}>+ Раздел</button>
        </div>
      </div>

      <div className="constructor-focus-note">
        <span>1. Перетащи раздел из библиотеки на поле.</span>
        <span>2. Двигай раздел за карточку в любую точку.</span>
        <span>3. Тяни точку справа, чтобы соединить разделы.</span>
        <span>4. Это отдельная карта связей, зоны тут не участвуют.</span>
      </div>

      <div className={`constructor-workbench${libraryCollapsed ? ' is-library-collapsed' : ''}`}>
        <aside className="constructor-library">
          <div className="constructor-library-panel">
            <div className="constructor-panel-title">Системные разделы</div>
            <div className="constructor-library-grid">
              {builtinCatalog.map((module) => (
                <div
                  key={module.key}
                  className={`constructor-library-chip${graphKeys.has(String(module.key)) ? ' is-selected' : ''}`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'copy'
                    event.dataTransfer.setData('text/workspace-module', String(module.key))
                    event.dataTransfer.setData('text/plain', String(module.key))
                    setPaletteDragging(module.key)
                  }}
                  onDragEnd={() => setPaletteDragging(null)}
                  title={module.description}
                >
                  <div className="constructor-library-chip-copy">
                    <div className="constructor-library-chip-title">{module.label}</div>
                    <div className="constructor-library-chip-route">{module.href}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="constructor-library-panel">
            <div className="constructor-panel-title">Свои разделы</div>
            <div className="constructor-library-grid">
              {customCatalog.length ? (
                customCatalog.map((module) => (
                  <div
                    key={module.key}
                    className={`constructor-library-chip is-custom${graphKeys.has(String(module.key)) ? ' is-selected' : ''}`}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'copy'
                      event.dataTransfer.setData('text/workspace-module', String(module.key))
                      event.dataTransfer.setData('text/plain', String(module.key))
                      setPaletteDragging(module.key)
                    }}
                    onDragEnd={() => setPaletteDragging(null)}
                  >
                    <div className="constructor-library-chip-copy">
                      <div className="constructor-library-chip-title">{module.label}</div>
                      <div className="constructor-library-chip-route">{module.href}</div>
                    </div>
                    <div className="constructor-library-chip-tools">
                      <a href={module.href} className="constructor-mini-button" title="Открыть раздел">↗</a>
                      <button type="button" className="constructor-mini-button" onClick={() => handleEditCustomModule(module)} title="Переименовать раздел">✎</button>
                      <button type="button" className="constructor-mini-button danger" onClick={() => handleDeleteCustomModule(module)} title="Удалить раздел">×</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="constructor-empty-note">Пока нет своих разделов. Создай нужный раздел и вытяни его на карту связей.</div>
              )}
            </div>
          </div>

          <div className="constructor-library-panel">
            <div className="constructor-panel-title">Что здесь собирается</div>
            <div className="constructor-capability-list">
              <span>Только разделы, без зон доступа</span>
              <span>Свободное позиционирование по canvas</span>
              <span>Визуальные цепочки между разделами</span>
              <span>Общая карта структуры продукта</span>
            </div>
          </div>
        </aside>

        <div className="constructor-board-shell">
          {notice ? <div className="constructor-notice">{notice}</div> : null}
          <div className="constructor-board-status">
            <span>{data.graphNodes.length} разделов на карте</span>
            <span>{data.graphLinks.length} визуальных связей</span>
            {pending ? <span>сохраняю…</span> : <span>готов</span>}
          </div>

          <div className="constructor-board-viewport">
            <div
              ref={stageRef}
              className="constructor-board-stage"
              style={{ width: boardMetrics.width, height: boardMetrics.height }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'copy'
              }}
              onDrop={handleStageDrop}
            >
              {!data.graphNodes.length ? <div className="graph-board-empty">Перетащи сюда разделы из библиотеки слева и собери карту связей без зон.</div> : null}

              <svg className="constructor-links" width={boardMetrics.width} height={boardMetrics.height} aria-hidden="true">
                {lines.map((line) => (
                  <path key={line.id} d={line.d} className="constructor-link-path" />
                ))}
                {linkDraft ? (
                  <path
                    d={`M ${linkDraft.x} ${linkDraft.y} C ${linkDraft.x + 72} ${linkDraft.y}, ${linkDraft.currentX - 72} ${linkDraft.currentY}, ${linkDraft.currentX} ${linkDraft.currentY}`}
                    className="constructor-link-path is-draft"
                  />
                ) : null}
              </svg>

              {lines.map((line) => (
                <button
                  key={`delete-${line.id}`}
                  type="button"
                  className="constructor-link-delete"
                  style={{ left: line.midX, top: line.midY }}
                  onClick={() => mutate({ action: 'graph-delete-link', linkId: line.id })}
                  title="Убрать связь"
                >
                  ×
                </button>
              ))}

              {data.graphNodes.map((node) => (
                <StageNode
                  key={node.key}
                  node={node}
                  layout={resolvedNodeLayout(node)}
                  onPointerDown={handleNodePointerDown}
                  onStartLink={handleStartLink}
                  onRemove={handleRemoveNode}
                  registerNode={registerNode}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
