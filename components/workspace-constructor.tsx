'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react'
import type {
  WorkspaceBuilderData,
  WorkspaceModuleDefinition,
  WorkspaceModuleKey,
  WorkspaceModuleLayout,
  WorkspaceModulePlacement,
  WorkspaceSpace,
  WorkspaceSpaceLayout,
} from '@/lib/influence-spaces'

function tint(hex: string, alpha: string) {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return `rgba(125, 211, 252, ${alpha})`
  const r = Number.parseInt(clean.slice(0, 2), 16)
  const g = Number.parseInt(clean.slice(2, 4), 16)
  const b = Number.parseInt(clean.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeEmailList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[;,\n]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
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
    case 'module_already_in_space':
      return 'Этот раздел уже лежит в выбранной зоне доступа.'
    case 'invalid_link':
      return 'Связь не создана. Нужны две разные карточки.'
    default:
      return value || 'Не удалось сохранить конструктор.'
  }
}

type LineGeometry = {
  id: string
  d: string
  midX: number
  midY: number
}

type LocalSpaceLayoutMap = Record<string, WorkspaceSpaceLayout>
type LocalModuleLayoutMap = Record<string, { spaceId: string; x: number; y: number }>

type SpaceZoneProps = {
  space: WorkspaceSpace
  layout: WorkspaceSpaceLayout
  placements: Array<{ placement: WorkspaceModulePlacement; layout: WorkspaceModuleLayout; previewSpaceId: string }>
  paletteDragging: WorkspaceModuleKey | null
  onRename: (spaceId: string, value: string) => void
  onMembersChange: (spaceId: string, value: string) => void
  onCycleColor: (spaceId: string) => void
  onDelete: (spaceId: string) => void
  onDropModule: (spaceId: string, x: number, y: number, moduleKey?: WorkspaceModuleKey | null) => void
  onSpacePointerDown: (space: WorkspaceSpace, event: ReactPointerEvent<HTMLDivElement>) => void
  onSpaceResizePointerDown: (space: WorkspaceSpace, event: ReactPointerEvent<HTMLButtonElement>) => void
  onModulePointerDown: (spaceId: string, placement: WorkspaceModulePlacement, event: ReactPointerEvent<HTMLDivElement>) => void
  onStartLink: (placementId: string, event: ReactPointerEvent<HTMLButtonElement>) => void
  onRemoveModule: (placementId: string) => void
  registerNode: (id: string, node: HTMLDivElement | null) => void
}

function SpaceZone({
  space,
  layout,
  placements,
  paletteDragging,
  onRename,
  onMembersChange,
  onCycleColor,
  onDelete,
  onDropModule,
  onSpacePointerDown,
  onSpaceResizePointerDown,
  onModulePointerDown,
  onStartLink,
  onRemoveModule,
  registerNode,
}: SpaceZoneProps) {
  const [name, setName] = useState(space.name)
  const [emails, setEmails] = useState(space.members.map((member) => member.assigned_email).join(', '))

  useEffect(() => {
    setName(space.name)
  }, [space.name])

  useEffect(() => {
    setEmails(space.members.map((member) => member.assigned_email).join(', '))
  }, [space.members])

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      const moduleKey = (event.dataTransfer.getData('text/workspace-module') || event.dataTransfer.getData('text/plain')) as WorkspaceModuleKey
      onDropModule(space.id, event.clientX - rect.left - 84, event.clientY - rect.top - 24, moduleKey || paletteDragging)
    },
    [onDropModule, paletteDragging, space.id],
  )

  return (
    <section
      className={`constructor-zone${paletteDragging ? ' is-droppable' : ''}`}
      style={{
        left: layout.x,
        top: layout.y,
        width: layout.width,
        height: layout.height,
        borderColor: tint(space.color, '0.68'),
        background: `linear-gradient(180deg, ${tint(space.color, '0.18')}, ${tint(space.color, '0.06')})`,
        boxShadow: `0 0 0 1px ${tint(space.color, '0.18')}, 0 24px 64px rgba(0, 0, 0, 0.24)`,
      }}
    >
      <div className="constructor-zone-head" onPointerDown={(event) => onSpacePointerDown(space, event)}>
        <button
          type="button"
          className="constructor-space-color"
          style={{ background: space.color }}
          onClick={(event) => {
            event.stopPropagation()
            onCycleColor(space.id)
          }}
          title="Сменить цвет зоны"
        />
        <div className="constructor-zone-copy">
          <div className="constructor-zone-title-row">
            <input
              className="constructor-zone-name"
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              onBlur={() => {
                const trimmed = name.trim()
                if (trimmed && trimmed !== space.name) onRename(space.id, trimmed)
                else setName(space.name)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
              }}
            />
            <span className="constructor-zone-badge">доступ {space.members.length}</span>
          </div>
          <input
            className="constructor-zone-members"
            value={emails}
            onChange={(event) => setEmails(event.currentTarget.value)}
            onBlur={() => onMembersChange(space.id, emails)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
            placeholder="email@domain.com, owner@domain.com"
            title="Кто видит это пространство"
          />
        </div>
        <button
          type="button"
          className="constructor-space-delete"
          onClick={(event) => {
            event.stopPropagation()
            onDelete(space.id)
          }}
          title="Удалить зону"
        >
          ×
        </button>
      </div>

      <div
        className="constructor-zone-body"
        data-space-dropzone={space.id}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={handleDrop}
      >
        {!placements.length ? <div className="constructor-zone-empty">Перетащи сюда раздел из библиотеки слева.</div> : null}

        {placements.map(({ placement, layout: placementLayout }) => (
          <div
            key={placement.id}
            ref={(node) => registerNode(placement.id, node)}
            className={`constructor-node${placement.module.kind === 'custom' ? ' is-custom' : ''}`}
            data-space-module-id={placement.id}
            style={{ left: placementLayout.x, top: placementLayout.y }}
          >
            <div className="constructor-node-card" onPointerDown={(event) => onModulePointerDown(space.id, placement, event)}>
              <div className="constructor-node-copy">
                <div className="constructor-node-label-row">
                  <span className="constructor-node-title">{placement.module.label}</span>
                  {placement.module.kind === 'custom' ? <span className="constructor-node-badge">свой</span> : null}
                </div>
                <div className="constructor-node-route">{placement.module.href}</div>
              </div>
              <div className="constructor-node-tools">
                <button
                  type="button"
                  className="constructor-node-tool"
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    onStartLink(placement.id, event)
                  }}
                  title="Потянуть визуальную связь"
                >
                  ●
                </button>
                <a
                  href={placement.module.href}
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
                    onRemoveModule(placement.id)
                  }}
                  title="Убрать раздел из зоны"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="constructor-zone-resizer"
        onPointerDown={(event) => onSpaceResizePointerDown(space, event)}
        title="Растянуть зону"
      />
    </section>
  )
}

export function WorkspaceConstructor({ initialData }: { initialData: WorkspaceBuilderData }) {
  const [data, setData] = useState<WorkspaceBuilderData>(initialData)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [paletteDragging, setPaletteDragging] = useState<WorkspaceModuleKey | null>(null)
  const [spaceDrafts, setSpaceDrafts] = useState<LocalSpaceLayoutMap>({})
  const [moduleDrafts, setModuleDrafts] = useState<LocalModuleLayoutMap>({})
  const [libraryCollapsed, setLibraryCollapsed] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [linkDraft, setLinkDraft] = useState<{
    fromPlacementId: string
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

  const resolvedSpaceLayout = useCallback(
    (space: WorkspaceSpace) => spaceDrafts[space.id] ?? space.layout,
    [spaceDrafts],
  )

  const resolvedModuleDraft = useCallback(
    (spaceId: string, placement: WorkspaceModulePlacement) => {
      const draft = moduleDrafts[placement.id]
      if (draft) return draft
      return { spaceId, x: placement.layout.x, y: placement.layout.y }
    },
    [moduleDrafts],
  )

  const boardMetrics = useMemo(() => {
    const width = Math.max(data.board.width, ...data.spaces.map((space) => resolvedSpaceLayout(space).x + resolvedSpaceLayout(space).width + 120))
    const height = Math.max(data.board.height, ...data.spaces.map((space) => resolvedSpaceLayout(space).y + resolvedSpaceLayout(space).height + 120))
    return { width, height }
  }, [data.board.height, data.board.width, data.spaces, resolvedSpaceLayout])

  const refreshGeometry = useCallback(() => {
    setMeasureTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(refreshGeometry)
    return () => cancelAnimationFrame(frame)
  }, [data, spaceDrafts, moduleDrafts, refreshGeometry])

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

    return data.visualLinks
      .map((link) => {
        const fromNode = nodeRefs.current[link.from_space_module_id]
        const toNode = nodeRefs.current[link.to_space_module_id]
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
  }, [data.visualLinks, data.spaces, measureTick])

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
      setSpaceDrafts({})
      setModuleDrafts({})
      refreshGeometry()
    } catch (error) {
      setNotice(errorMessage(error))
      setSpaceDrafts({})
      setModuleDrafts({})
    } finally {
      setPending(false)
    }
  }

  const handleCreateSpace = useCallback(async () => {
    const name = window.prompt('Название новой зоны', 'Новая зона')
    if (name === null) return
    await mutate({ action: 'create-space', name })
  }, [])

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
    await mutate({ action: 'seed-starter' })
  }, [])


  const handleToggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await document.documentElement.requestFullscreen()
  }, [])

  const handleRename = useCallback(async (spaceId: string, value: string) => {
    await mutate({ action: 'rename-space', spaceId, name: value })
  }, [])

  const handleMembersChange = useCallback(async (spaceId: string, value: string) => {
    await mutate({ action: 'sync-space-members', spaceId, emails: normalizeEmailList(value) })
  }, [])

  const handleCycleColor = useCallback(async (spaceId: string) => {
    await mutate({ action: 'cycle-space-color', spaceId })
  }, [])

  const handleDelete = useCallback(async (spaceId: string) => {
    if (!window.confirm('Удалить эту зону целиком?')) return
    await mutate({ action: 'delete-space', spaceId })
  }, [])

  const handleRemoveModule = useCallback(async (placementId: string) => {
    await mutate({ action: 'remove-module', placementId })
  }, [])

  const registerNode = useCallback((id: string, node: HTMLDivElement | null) => {
    nodeRefs.current[id] = node
  }, [])

  const handleDropModule = useCallback(
    async (spaceId: string, x: number, y: number, moduleKey?: WorkspaceModuleKey | null) => {
      if (!moduleKey) return
      await mutate({
        action: 'move-module',
        targetSpaceId: spaceId,
        placementId: null,
        moduleKey,
        x: Math.max(12, Math.round(x)),
        y: Math.max(12, Math.round(y)),
      })
      setPaletteDragging(null)
    },
    [],
  )

  const handleSpacePointerDown = useCallback(
    (space: WorkspaceSpace, event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      const target = event.target as HTMLElement
      if (target.closest('input,button,a')) return
      const stage = stageRef.current
      if (!stage) return

      event.preventDefault()
      const layout = resolvedSpaceLayout(space)
      const stageBox = stage.getBoundingClientRect()
      const offsetX = event.clientX - stageBox.left - layout.x
      const offsetY = event.clientY - stageBox.top - layout.y

      const move = (pointerEvent: PointerEvent) => {
        const nextX = clamp(pointerEvent.clientX - stageBox.left - offsetX, 16, 8000)
        const nextY = clamp(pointerEvent.clientY - stageBox.top - offsetY, 16, 8000)
        setSpaceDrafts((current) => ({
          ...current,
          [space.id]: {
            ...layout,
            x: nextX,
            y: nextY,
          },
        }))
      }

      const up = async (pointerEvent: PointerEvent) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        const draft = spaceDrafts[space.id] ?? layout
        const nextX = clamp(pointerEvent.clientX - stageBox.left - offsetX, 16, 8000)
        const nextY = clamp(pointerEvent.clientY - stageBox.top - offsetY, 16, 8000)
        setSpaceDrafts((current) => ({
          ...current,
          [space.id]: {
            ...draft,
            x: nextX,
            y: nextY,
          },
        }))
        await mutate({ action: 'update-space-layout', spaceId: space.id, x: nextX, y: nextY, width: draft.width, height: draft.height })
      }

      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [resolvedSpaceLayout, spaceDrafts],
  )

  const handleSpaceResizePointerDown = useCallback(
    (space: WorkspaceSpace, event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      const layout = resolvedSpaceLayout(space)
      const startX = event.clientX
      const startY = event.clientY

      const move = (pointerEvent: PointerEvent) => {
        const width = clamp(layout.width + (pointerEvent.clientX - startX), 420, 1400)
        const height = clamp(layout.height + (pointerEvent.clientY - startY), 280, 1200)
        setSpaceDrafts((current) => ({
          ...current,
          [space.id]: {
            ...layout,
            width,
            height,
          },
        }))
      }

      const up = async (pointerEvent: PointerEvent) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        const width = clamp(layout.width + (pointerEvent.clientX - startX), 420, 1400)
        const height = clamp(layout.height + (pointerEvent.clientY - startY), 280, 1200)
        setSpaceDrafts((current) => ({
          ...current,
          [space.id]: {
            ...layout,
            width,
            height,
          },
        }))
        await mutate({ action: 'update-space-layout', spaceId: space.id, x: layout.x, y: layout.y, width, height })
      }

      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [resolvedSpaceLayout],
  )

  const handleModulePointerDown = useCallback(
    (spaceId: string, placement: WorkspaceModulePlacement, event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      const target = event.target as HTMLElement
      if (target.closest('button,a,input')) return
      event.preventDefault()

      const node = event.currentTarget.parentElement as HTMLDivElement | null
      if (!node) return
      const initialRect = node.getBoundingClientRect()
      const offsetX = event.clientX - initialRect.left
      const offsetY = event.clientY - initialRect.top
      const initial = resolvedModuleDraft(spaceId, placement)

      const computeDraft = (clientX: number, clientY: number) => {
        const targetZone = document.elementFromPoint(clientX, clientY)?.closest('[data-space-dropzone]') as HTMLElement | null
        const activeZone = targetZone ?? node.closest('[data-space-dropzone]')
        if (!activeZone) return null
        const zoneId = activeZone.getAttribute('data-space-dropzone')
        if (!zoneId) return null
        const zoneRect = activeZone.getBoundingClientRect()
        return {
          spaceId: zoneId,
          x: clamp(clientX - zoneRect.left - offsetX, 12, Math.max(12, zoneRect.width - initialRect.width - 12)),
          y: clamp(clientY - zoneRect.top - offsetY, 12, Math.max(12, zoneRect.height - initialRect.height - 12)),
        }
      }

      const move = (pointerEvent: PointerEvent) => {
        const draft = computeDraft(pointerEvent.clientX, pointerEvent.clientY)
        if (!draft) return
        setModuleDrafts((current) => ({
          ...current,
          [placement.id]: draft,
        }))
      }

      const up = async (pointerEvent: PointerEvent) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        const draft = computeDraft(pointerEvent.clientX, pointerEvent.clientY) ?? initial
        setModuleDrafts((current) => ({
          ...current,
          [placement.id]: draft,
        }))
        await mutate({
          action: 'move-module',
          targetSpaceId: draft.spaceId,
          placementId: placement.id,
          moduleKey: placement.key,
          x: Math.round(draft.x),
          y: Math.round(draft.y),
        })
      }

      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [resolvedModuleDraft],
  )

  const handleStartLink = useCallback((placementId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const stage = stageRef.current
    if (!stage) return
    const stageBox = stage.getBoundingClientRect()
    const x = event.clientX - stageBox.left
    const y = event.clientY - stageBox.top
    setLinkDraft({ fromPlacementId: placementId, x, y, currentX: x, currentY: y })

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
      const target = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)?.closest('[data-space-module-id]')
      const targetId = target?.getAttribute('data-space-module-id') ?? null
      setLinkDraft(null)
      if (!targetId || targetId === placementId) return
      await mutate({ action: 'create-link', fromSpaceModuleId: placementId, toSpaceModuleId: targetId })
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [])

  return (
    <section className="card constructor-shell">
      <div className="constructor-topbar">
        <div>
          <div className="constructor-kicker">builder studio / spaces</div>
          <h1 className="page-title" style={{ marginBottom: 6 }}>Распределение разделов по зонам</h1>
          <div className="micro">
            Здесь только зоны доступа. Создаёшь пространства, раскладываешь в них разделы, таскаешь карточки внутри зон и визуально связываешь узлы.
          </div>
        </div>
        <div className="constructor-topbar-actions">
          <a href="/dashboard" className="button-secondary">← Панель</a>
          <button type="button" className="button-secondary" disabled>Зоны доступа</button>
          <a href="/dashboard/spaces/graph" className="button-secondary">Карта связей</a>
          <button type="button" className="button-secondary" onClick={() => setLibraryCollapsed((value) => !value)}>
            {libraryCollapsed ? 'Показать библиотеку' : 'Скрыть библиотеку'}
          </button>
          <button type="button" className="button-secondary" onClick={handleToggleFullscreen}>
            {isFullscreen ? 'Окно' : 'Во весь экран'}
          </button>
          <button type="button" className="button-secondary" onClick={handleSeed}>Старт</button>
          <button type="button" className="button-secondary" onClick={handleCreateCustomModule}>+ Раздел</button>
          <button type="button" className="button" onClick={handleCreateSpace}>+ Зона</button>
        </div>
      </div>

      <div className="constructor-focus-note">
        <span>1. Перетащи раздел из библиотеки в зону.</span>
        <span>2. Двигай зону за шапку.</span>
        <span>3. Двигай раздел за карточку.</span>
        <span>4. Тяни точку справа, чтобы сделать визуальную связь.</span>
      </div>

      <div className={`constructor-workbench${libraryCollapsed ? ' is-library-collapsed' : ''}`}>
        <aside className="constructor-library">
          <div className="constructor-library-panel">
            <div className="constructor-panel-title">Системные разделы</div>
            <div className="constructor-library-grid">
              {builtinCatalog.map((module) => (
                <div
                  key={module.key}
                  className="constructor-library-chip"
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
                    className="constructor-library-chip is-custom"
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
                <div className="constructor-empty-note">Пока нет своих разделов. Создай и перетащи их в нужную зону доступа.</div>
              )}
            </div>
          </div>

          <div className="constructor-library-panel">
            <div className="constructor-panel-title">Что это сейчас умеет</div>
            <div className="constructor-capability-list">
              <span>Свободное размещение зон</span>
              <span>Свободное размещение разделов</span>
              <span>Визуальные связи между разделами</span>
              <span>Привязка разделов к зонам доступа</span>
            </div>
          </div>
        </aside>

        <div className="constructor-board-shell">
          {notice ? <div className="constructor-notice">{notice}</div> : null}
          <div className="constructor-board-status">
            <span>{data.spaces.length} зон</span>
            <span>{data.spaces.reduce((sum, space) => sum + space.modules.length, 0)} разделов на поле</span>
            <span>{data.visualLinks.length} визуальных связей</span>
            {pending ? <span>сохраняю…</span> : <span>готов</span>}
          </div>

          <div className="constructor-board-viewport">
            <div ref={stageRef} className="constructor-board-stage" style={{ width: boardMetrics.width, height: boardMetrics.height }}>
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
                  onClick={() => mutate({ action: 'delete-link', linkId: line.id })}
                  title="Убрать связь"
                >
                  ×
                </button>
              ))}

              {data.spaces.map((space) => {
                const spaceLayout = resolvedSpaceLayout(space)
                const placements = space.modules
                  .map((placement) => {
                    const draft = resolvedModuleDraft(space.id, placement)
                    return {
                      placement,
                      layout: { x: draft.x, y: draft.y },
                      previewSpaceId: draft.spaceId,
                    }
                  })
                  .filter((entry) => entry.previewSpaceId === space.id)

                return (
                  <SpaceZone
                    key={space.id}
                    space={space}
                    layout={spaceLayout}
                    placements={placements}
                    paletteDragging={paletteDragging}
                    onRename={handleRename}
                    onMembersChange={handleMembersChange}
                    onCycleColor={handleCycleColor}
                    onDelete={handleDelete}
                    onDropModule={handleDropModule}
                    onSpacePointerDown={handleSpacePointerDown}
                    onSpaceResizePointerDown={handleSpaceResizePointerDown}
                    onModulePointerDown={handleModulePointerDown}
                    onStartLink={handleStartLink}
                    onRemoveModule={handleRemoveModule}
                    registerNode={registerNode}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
