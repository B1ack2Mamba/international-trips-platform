import Link from 'next/link'
import { notFound } from 'next/navigation'
import { convertLeadToDeal, takeLead, updateLeadStatus } from '../actions'
import { formatDateTime } from '@/lib/format'
import { dealStageOptions, label, leadStatusOptions } from '@/lib/labels'
import { getActivityLog, getLeadById, getSalesScriptsBySegment } from '@/lib/queries'

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lead = await getLeadById(id)
  if (!lead) notFound()

  const [activities, scripts] = await Promise.all([
    getActivityLog('lead', id, 20),
    lead.desired_program?.segment ? getSalesScriptsBySegment(lead.desired_program.segment, 6) : Promise.resolve([]),
  ])

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <div className="micro">Лид #{lead.id.slice(0, 8)}</div>
          <h1 className="page-title">{lead.contact_name_raw || 'Без имени'}</h1>
          <p className="muted">Карточка, в которой входящий шум должен превратиться в управляемый процесс.</p>
        </div>
        <Link className="button-secondary" href="/dashboard/leads">Назад к списку</Link>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <div className="badge-row">
            <span className="badge success">{label('leadStatus', lead.status)}</span>
            <span className="badge">{label('channel', lead.source_channel)}</span>
            {lead.desired_program?.segment ? <span className="badge">{label('segment', lead.desired_program.segment)}</span> : null}
          </div>
          <h2 style={{ margin: 0 }}>Карточка контакта</h2>
          <div className="grid-2">
            <div><div className="micro">Телефон</div><div>{lead.phone_raw || '—'}</div></div>
            <div><div className="micro">Email</div><div>{lead.email_raw || '—'}</div></div>
            <div><div className="micro">Назначен</div><div>{lead.owner?.full_name || 'Не назначен'}</div></div>
            <div><div className="micro">Создан</div><div>{formatDateTime(lead.created_at)}</div></div>
            <div><div className="micro">Программа</div><div>{lead.desired_program?.title || 'Не выбрана'}</div></div>
            <div><div className="micro">Выезд</div><div>{lead.desired_departure?.departure_name || 'Не выбран'}</div></div>
            <div><div className="micro">Партнёр</div><div>{lead.partner?.display_name || '—'}</div></div>
            <div><div className="micro">Блокировка владения</div><div>{label('lockStatus', lead.ownership_lock_status || 'none')}{lead.ownership_locked_until ? ` · до ${formatDateTime(lead.ownership_locked_until)}` : ''}</div></div>
          </div>
          <div><div className="micro">Комментарий</div><div>{lead.message || '—'}</div></div>
          {lead.converted_deal_id ? (
            <div className="notice">Этот лид уже конвертирован. <Link href={`/dashboard/deals/${lead.converted_deal_id}`}>Открыть сделку</Link></div>
          ) : null}
          {!lead.owner_user_id ? (
            <form action={takeLead}><input type="hidden" name="lead_id" value={lead.id} /><button className="button">Взять лид в работу</button></form>
          ) : null}
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Смена статуса</h2>
          <form action={updateLeadStatus}>
            <input type="hidden" name="lead_id" value={lead.id} />
            <div className="form-grid">
              <label>
                Новый статус
                <select name="status" defaultValue={lead.status}>
                  {leadStatusOptions.map((status) => <option key={status} value={status}>{label('leadStatus', status)}</option>)}
                </select>
              </label>
              <label>
                Следующее действие до
                <input name="next_action_at" type="datetime-local" />
              </label>
            </div>
            <label>Примечание<textarea name="note" placeholder="Почему меняем статус и что делать дальше" /></label>
            <div className="form-actions"><button className="button">Сохранить статус</button></div>
          </form>
        </article>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Конвертировать в сделку</h2>
          <form action={convertLeadToDeal}>
            <input type="hidden" name="lead_id" value={lead.id} />
            <div className="form-grid">
              <label>Название сделки<input name="title" defaultValue={`${lead.desired_program?.title || lead.desired_country || 'Программа'} / ${lead.contact_name_raw || 'Контакт'}`} required /></label>
              <label>Стадия<select name="stage" defaultValue="qualified">{dealStageOptions.map((stage) => <option key={stage} value={stage}>{label('dealStage', stage)}</option>)}</select></label>
              <label>Оценка суммы<input name="estimated_value" type="number" min="0" step="1000" placeholder="180000" /></label>
              <label>Валюта<select name="currency" defaultValue="RUB"><option value="RUB">RUB</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="CNY">CNY</option></select></label>
              <label>Участников<input name="participants_count" type="number" min="1" defaultValue="1" /></label>
              <label>План закрытия<input name="close_date" type="date" /></label>
            </div>
            <label>Комментарий для сделки<textarea name="notes" defaultValue={lead.message || ''} /></label>
            <label className="inline-checkbox"><input name="create_account" type="checkbox" defaultChecked /><span>Создать или привязать аккаунт семьи автоматически</span></label>
            <div className="form-actions"><button className="button">Создать сделку</button></div>
          </form>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Контекст и подсказки</h2>
          <div><div className="micro">UTM / метаданные</div><pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(lead.metadata ?? {}, null, 2)}</pre></div>
          {scripts.length ? (
            <div className="stack">
              <div className="micro">Скрипты по сегменту</div>
              {scripts.map((script) => <div key={script.id} className="notice"><div style={{ fontWeight: 700 }}>{script.title}</div><div className="micro">{script.stage}</div><div>{script.body}</div></div>)}
            </div>
          ) : <div className="muted">Для этого сегмента пока нет скриптов.</div>}
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>История действий</h2>
        {activities.length ? (
          <div className="table-wrap"><table className="table"><thead><tr><th>Событие</th><th>Комментарий</th><th>Кто</th><th>Когда</th></tr></thead><tbody>{activities.map((activity) => <tr key={activity.id}><td><div>{activity.title}</div><div className="micro">{activity.event_type}</div></td><td>{activity.body || '—'}</td><td>{activity.actor?.full_name || activity.actor?.email || 'система'}</td><td>{formatDateTime(activity.created_at)}</td></tr>)}</tbody></table></div>
        ) : <div className="muted">История пока пустая.</div>}
      </article>
    </div>
  )
}
