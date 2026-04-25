import Link from 'next/link'
import { EmptyState } from '@/components/empty-state'
import { requireDashboardAccess } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { getSystemOpsSummary } from '@/lib/queries'
import { canPerform } from '@/lib/roles'
import { markSystemInboxHandledAction, requeueOutboxMessageAction } from './actions'

export const dynamic = 'force-dynamic'

type SystemKind =
  | 'message_failed'
  | 'message_stuck'
  | 'call_failed'
  | 'contract_waiting'
  | 'inbox_unhandled'
  | 'deal_contract_blocked'
  | 'deal_payment_blocked'
  | 'deal_application_blocked'

function issueLabel(kind: SystemKind) {
  switch (kind) {
    case 'message_failed':
      return 'Сообщение'
    case 'message_stuck':
      return 'Очередь'
    case 'call_failed':
      return 'Телефония'
    case 'contract_waiting':
      return 'Договор'
    case 'inbox_unhandled':
      return 'Inbox'
    case 'deal_contract_blocked':
      return 'Сделка'
    case 'deal_payment_blocked':
      return 'Оплата'
    case 'deal_application_blocked':
      return 'Передача'
    default:
      return kind
  }
}

function slaLabel(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const hours = Math.max(1, Math.floor(diffMs / (60 * 60 * 1000)))
  if (hours < 24) return `${hours}ч`
  const days = Math.floor(hours / 24)
  return `${days}д ${hours % 24}ч`
}

const FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'danger', label: 'Критичные' },
  { key: 'communications', label: 'Коммуникации' },
  { key: 'deals', label: 'Сделки' },
  { key: 'contracts', label: 'Договоры' },
] as const

const SCOPE_FILTERS = [
  { key: 'all', label: 'Все проблемы' },
  { key: 'mine', label: 'Мои проблемы' },
] as const

function matchesFilter(
  filter: (typeof FILTERS)[number]['key'],
  item: { kind: SystemKind; tone: 'danger' | 'warning' },
) {
  if (filter === 'all') return true
  if (filter === 'danger') return item.tone === 'danger'
  if (filter === 'communications') return ['message_failed', 'message_stuck', 'call_failed', 'inbox_unhandled'].includes(item.kind)
  if (filter === 'deals') return ['deal_contract_blocked', 'deal_payment_blocked', 'deal_application_blocked'].includes(item.kind)
  if (filter === 'contracts') return item.kind === 'contract_waiting'
  return true
}

function SystemKpi({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: 'neutral' | 'warning' | 'danger'
}) {
  const toneClass = tone === 'danger' ? ' danger' : tone === 'warning' ? ' warning' : ''

  return (
    <div className={`card kpi${toneClass}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="micro">Обновляется при открытии страницы</div>
    </div>
  )
}

export default async function SystemPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { profile } = await requireDashboardAccess('/dashboard/system')
  const params = (await searchParams) ?? {}
  const summary = await getSystemOpsSummary()
  const canManageOutbox = canPerform(profile?.role, 'communication.outbox_manage')
  const filterParam = typeof params.filter === 'string' ? params.filter : 'all'
  const scopeParam = typeof params.scope === 'string' ? params.scope : 'all'
  const ownerParam = typeof params.owner === 'string' ? params.owner : 'all'
  const filter: (typeof FILTERS)[number]['key'] = FILTERS.some((item) => item.key === filterParam) ? filterParam as (typeof FILTERS)[number]['key'] : 'all'
  const scope: (typeof SCOPE_FILTERS)[number]['key'] = SCOPE_FILTERS.some((item) => item.key === scopeParam) ? scopeParam as (typeof SCOPE_FILTERS)[number]['key'] : 'all'
  const ownerOptions = Array.from(
    new Map(
      summary.items
        .filter((item) => item.owner_id && item.owner_name)
        .map((item) => [item.owner_id as string, { id: item.owner_id as string, name: item.owner_name as string }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  const filteredItems = summary.items.filter((item) => {
    if (!matchesFilter(filter, item)) return false
    if (scope === 'mine' && item.owner_id !== profile?.id) return false
    if (ownerParam !== 'all' && item.owner_id !== ownerParam) return false
    return true
  })

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <h1 className="page-title">Система</h1>
          <p className="muted">Операционный экран для сбоев, зависших процессов и объектов, требующих ручной проверки.</p>
        </div>
      </section>

      <section className="kpi-grid kpi-grid--compact">
        <SystemKpi label="Упавшие сообщения" value={summary.failed_messages} tone={summary.failed_messages ? 'danger' : 'neutral'} />
        <SystemKpi label="Зависшие отправки" value={summary.stuck_messages} tone={summary.stuck_messages ? 'warning' : 'neutral'} />
        <SystemKpi label="Сбои звонков" value={summary.failed_calls} tone={summary.failed_calls ? 'danger' : 'neutral'} />
        <SystemKpi label="Договоры без движения" value={summary.stale_contracts} tone={summary.stale_contracts ? 'warning' : 'neutral'} />
        <SystemKpi label="Необработанный inbox" value={summary.stale_inbox} tone={summary.stale_inbox ? 'warning' : 'neutral'} />
        <SystemKpi label="Проблемные сделки" value={summary.stale_deals} tone={summary.stale_deals ? 'warning' : 'neutral'} />
      </section>

      <article className="card stack">
        <div className="section-mini-head">
          <h2>Блокеры воронки</h2>
          <span className="badge">{summary.stale_deals}</span>
        </div>
        <div className="badge-row">
          <span className={`badge ${summary.blocked_deals_without_contract ? 'danger' : ''}`}>Без договора: {summary.blocked_deals_without_contract}</span>
          <span className={`badge ${summary.blocked_deals_without_payment ? 'warning' : ''}`}>Без полной оплаты: {summary.blocked_deals_without_payment}</span>
          <span className={`badge ${summary.blocked_deals_without_application ? 'warning' : ''}`}>Не переданы в участники: {summary.blocked_deals_without_application}</span>
        </div>
      </article>

      {summary.items.length ? (
        <article className="card stack">
          <div className="section-mini-head">
            <h2>Живая очередь проблем</h2>
            <span className="badge">{filteredItems.length}</span>
          </div>
          <div className="badge-row">
            {SCOPE_FILTERS.map((item) => {
              const count = summary.items.filter((row) => (item.key === 'mine' ? row.owner_id === profile?.id : true)).length
              const href = `/dashboard/system?scope=${item.key}${filter !== 'all' ? `&filter=${filter}` : ''}${ownerParam !== 'all' ? `&owner=${ownerParam}` : ''}`
              return (
                <Link key={item.key} href={href} className={`badge ${scope === item.key ? 'success' : ''}`}>
                  {item.label}: {count}
                </Link>
              )
            })}
          </div>
          <div className="badge-row">
            {FILTERS.map((item) => {
              const count = summary.items.filter((row) => {
                if (!matchesFilter(item.key, row)) return false
                if (scope === 'mine' && row.owner_id !== profile?.id) return false
                if (ownerParam !== 'all' && row.owner_id !== ownerParam) return false
                return true
              }).length
              const query = new URLSearchParams()
              if (item.key !== 'all') query.set('filter', item.key)
              if (scope !== 'all') query.set('scope', scope)
              if (ownerParam !== 'all') query.set('owner', ownerParam)
              return (
                <Link key={item.key} href={`/dashboard/system${query.toString() ? `?${query.toString()}` : ''}`} className={`badge ${filter === item.key ? 'success' : ''}`}>
                  {item.label}: {count}
                </Link>
              )
            })}
            {ownerOptions.map((owner) => {
              const query = new URLSearchParams()
              if (filter !== 'all') query.set('filter', filter)
              if (scope !== 'all') query.set('scope', scope)
              query.set('owner', owner.id)
              const count = summary.items.filter((row) => {
                if (row.owner_id !== owner.id) return false
                if (!matchesFilter(filter, row)) return false
                if (scope === 'mine' && row.owner_id !== profile?.id) return false
                return true
              }).length
              return (
                <Link key={owner.id} href={`/dashboard/system?${query.toString()}`} className={`badge ${ownerParam === owner.id ? 'success' : ''}`}>
                  {owner.name}: {count}
                </Link>
              )
            })}
            {ownerParam !== 'all' ? (
              <Link
                href={`/dashboard/system${(() => {
                  const query = new URLSearchParams()
                  if (filter !== 'all') query.set('filter', filter)
                  if (scope !== 'all') query.set('scope', scope)
                  return query.toString() ? `?${query.toString()}` : ''
                })()}`}
                className="badge"
              >
                Сбросить владельца
              </Link>
            ) : null}
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Объект</th>
                  <th>Ответственный</th>
                  <th>Детали</th>
                  <th>SLA</th>
                  <th>Когда</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className={`badge ${item.tone === 'danger' ? 'danger' : item.tone === 'warning' ? 'warning' : ''}`}>
                        {issueLabel(item.kind)}
                      </span>
                    </td>
                    <td>
                      <div><strong>{item.title}</strong></div>
                    </td>
                    <td>{item.owner_name || 'Не назначен'}</td>
                    <td>{item.detail}</td>
                    <td>{slaLabel(item.created_at)}</td>
                    <td>{formatDateTime(item.created_at)}</td>
                    <td>
                      <div className="form-actions">
                        <Link href={item.href}>Открыть</Link>
                        {item.quick_action_href && item.quick_action_label ? (
                          <Link className="button-secondary" href={item.quick_action_href}>{item.quick_action_label}</Link>
                        ) : null}
                        {canManageOutbox && item.primary_action === 'requeue_outbox' && item.entity_id ? (
                          <form action={requeueOutboxMessageAction}>
                            <input type="hidden" name="message_id" value={item.entity_id} />
                            <button className="button-secondary">В очередь</button>
                          </form>
                        ) : null}
                        {canManageOutbox && item.primary_action === 'mark_inbox_handled' && item.entity_id ? (
                          <form action={markSystemInboxHandledAction}>
                            <input type="hidden" name="message_id" value={item.entity_id} />
                            <input type="hidden" name="lead_id" value={item.lead_id || ''} />
                            <button className="button-secondary">Закрыть</button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredItems.length ? (
                  <tr>
                    <td colSpan={7}>По этому фильтру проблем сейчас нет.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      ) : (
        <EmptyState
          title="Критичных проблем не найдено"
          text="Очереди сообщений, телефония, договоры и входящий inbox сейчас выглядят стабильно."
        />
      )}
    </div>
  )
}
