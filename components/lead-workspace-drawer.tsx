import Link from 'next/link'
import { convertLeadToDeal, takeLead, transferLeadOwner, updateLeadStatus } from '@/app/dashboard/leads/actions'
import { label } from '@/lib/labels'
import type { LeadAssignableProfile } from '@/lib/lead-access'
import type { LeadRow, SalesScriptRow } from '@/lib/queries'

export function LeadWorkspaceDrawer({
  lead,
  scripts,
  assignableProfiles,
  scriptsMode = false,
  readyMode = false,
  returnPath = '/dashboard/leads',
}: {
  lead: LeadRow
  scripts: SalesScriptRow[]
  assignableProfiles: LeadAssignableProfile[]
  scriptsMode?: boolean
  readyMode?: boolean
  returnPath?: string
}) {
  const transferTargets = assignableProfiles.filter((profile) => profile.id !== lead.owner_user_id)
  const displayStatus = lead.converted_deal_id
    ? 'Сделка'
    : ['archived', 'duplicate', 'disqualified'].includes(lead.status)
      ? 'Архив'
      : lead.owner_user_id
        ? 'Взять в работу'
        : 'Новый'

  return (
    <aside className="card stack deal-editor-drawer" id="lead-editor">
      <div className="compact-toolbar">
        <div>
          <div className="micro">Боковая панель лида</div>
          <h2 style={{ margin: 0 }}>{lead.contact_name_raw || 'Без имени'}</h2>
          <div className="micro">Редакция идёт прямо здесь: строка открывает карточку справа, статус управляет следующим шагом.</div>
        </div>
        <div className="compact-badges">
          <span className={`badge ${lead.converted_deal_id ? '' : 'success'}`}>{displayStatus}</span>
          <span className="badge">{label('channel', lead.source_channel)}</span>
        </div>
      </div>

      <div className="deal-drawer-meta-grid">
        <div className="card-subtle">
          <div className="micro">Контакт</div>
          <strong>{lead.phone_raw || 'Телефон не указан'}</strong>
          <div className="micro">{lead.email_raw || 'Email не указан'}</div>
        </div>
        <div className="card-subtle">
          <div className="micro">Интерес</div>
          <strong>{lead.desired_program?.title || lead.desired_country || 'Интерес не указан'}</strong>
          <div className="micro">{lead.desired_departure?.departure_name || 'Выезд не выбран'}</div>
        </div>
      </div>

      <div className="card-subtle stack">
        <div className="micro">Комментарий и контекст</div>
        <div className="compact-note-list">
          <div><strong>Источник:</strong> <span className="micro-inline">{label('channel', lead.source_channel)}</span></div>
          <div><strong>Менеджер:</strong> <span className="micro-inline">{lead.owner?.full_name || lead.owner?.email || 'Не назначен'}</span></div>
          <div><strong>Комментарий:</strong> <span className="micro-inline">{lead.message || 'Пусто'}</span></div>
          {lead.converted_deal_id ? <div><strong>Статус лида:</strong> <span className="micro-inline">Сделка</span></div> : null}
        </div>
      </div>

      <div className="card-subtle stack">
        <div className="micro">Действия по лиду</div>
        <div className="form-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          <Link className="button-secondary" href={`/dashboard/leads/${lead.id}`}>Полная карточка</Link>
          {!lead.converted_deal_id && !lead.owner_user_id ? (
            <form action={takeLead}>
              <input type="hidden" name="lead_id" value={lead.id} />
              <button className="button-secondary">Взять в работу</button>
            </form>
          ) : null}
          {lead.converted_deal_id ? (
            <Link className="button-secondary" href={`/dashboard/deals?open=${lead.converted_deal_id}#deal-editor`}>К сделке</Link>
          ) : null}
          {!lead.converted_deal_id && lead.owner_user_id && lead.status !== 'archived' ? (
            <form action={updateLeadStatus}>
              <input type="hidden" name="lead_id" value={lead.id} />
              <input type="hidden" name="status" value="archived" />
              <button className="button-secondary">В архив</button>
            </form>
          ) : null}
        </div>
      </div>

      {!lead.converted_deal_id && lead.owner_user_id ? (
        <div className="card-subtle stack">
          <h3 style={{ margin: 0 }}>Передать лид</h3>
          <form action={transferLeadOwner}>
            <input type="hidden" name="lead_id" value={lead.id} />
            <label>
              Новый менеджер
              <select name="owner_user_id" required defaultValue="">
                <option value="" disabled>Выберите пользователя</option>
                {transferTargets.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name || profile.email || profile.id}
                  </option>
                ))}
              </select>
            </label>
            <label>Комментарий к передаче<textarea name="note" placeholder="Почему передаём и что важно учесть" required /></label>
            <div className="form-actions"><button className="button-secondary">Передать</button></div>
          </form>
        </div>
      ) : null}

      {lead.owner_user_id && lead.status !== 'archived' || scriptsMode ? (
        <div className="stack">
          <div className="inline-card">
            <div>
              <h3 style={{ margin: 0 }}>Скрипты для работы с лидом</h3>
              <div className="micro">Панель можно оставить справа или свернуть, уйдя на другую строку.</div>
            </div>
          </div>
          {scripts.length ? scripts.map((script) => (
            <div key={script.id} className="notice">
              <div style={{ fontWeight: 700 }}>{script.title}</div>
              <div className="micro">{script.stage}</div>
              <div>{script.body}</div>
            </div>
          )) : <div className="notice">Для этого сегмента пока нет скриптов. Можно добавить их позже в разделе «Скрипты».</div>}
        </div>
      ) : null}

      {lead.owner_user_id && lead.status !== 'archived' && !lead.converted_deal_id ? (
        <form action={convertLeadToDeal}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <input type="hidden" name="title" value={`${lead.desired_program?.title || lead.desired_country || 'Программа'} / ${lead.contact_name_raw || 'Контакт'}`} />
          <input type="hidden" name="stage" value="qualified" />
          <input type="hidden" name="participants_count" value="1" />
          <input type="hidden" name="currency" value="RUB" />
          <input type="hidden" name="notes" value={lead.message || 'Сделка оформлена из лида.'} />
          <div className="notice">
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Перевести в сделку</div>
            <div className="micro">Когда договорились с клиентом, создайте сделку прямо из этой панели.</div>
          </div>
          <div className="form-actions"><button className="button">Оформить сделку</button></div>
        </form>
      ) : null}

      <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
        <Link className="button-secondary" href={returnPath}>Закрыть панель</Link>
      </div>
    </aside>
  )
}
