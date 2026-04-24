import Link from 'next/link'
import { EmptyState } from '@/components/empty-state'
import { requireDashboardAccess } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { getSystemOpsSummary } from '@/lib/queries'
import { canPerform } from '@/lib/roles'
import { markSystemInboxHandledAction, requeueOutboxMessageAction } from './actions'

export const dynamic = 'force-dynamic'

function issueLabel(kind: 'message_failed' | 'message_stuck' | 'call_failed' | 'contract_waiting' | 'inbox_unhandled') {
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
    default:
      return kind
  }
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

export default async function SystemPage() {
  const { profile } = await requireDashboardAccess('/dashboard/system')
  const summary = await getSystemOpsSummary()
  const canManageOutbox = canPerform(profile?.role, 'communication.outbox_manage')

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
      </section>

      {summary.items.length ? (
        <article className="card stack">
          <div className="section-mini-head">
            <h2>Живая очередь проблем</h2>
            <span className="badge">{summary.items.length}</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Объект</th>
                  <th>Детали</th>
                  <th>Когда</th>
                  <th>Открыть</th>
                </tr>
              </thead>
              <tbody>
                {summary.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className={`badge ${item.tone === 'danger' ? 'danger' : item.tone === 'warning' ? 'warning' : ''}`}>
                        {issueLabel(item.kind)}
                      </span>
                    </td>
                    <td>
                      <div><strong>{item.title}</strong></div>
                    </td>
                    <td>{item.detail}</td>
                    <td>{formatDateTime(item.created_at)}</td>
                    <td>
                      <div className="form-actions">
                        <Link href={item.href}>Открыть</Link>
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
