import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updateContractStatusAction } from '../actions'
import { getSiteUrl } from '@/lib/env'
import { formatDateTime } from '@/lib/format'
import { contractStatusOptions, label } from '@/lib/labels'
import { getActivityLog, getApplicationById, getContractById } from '@/lib/queries'

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contract = await getContractById(id)
  if (!contract) notFound()

  const [application, activities] = await Promise.all([
    contract.application_id ? getApplicationById(contract.application_id) : Promise.resolve(null),
    getActivityLog('contract', id, 30),
  ])

  const portalUrl = application ? `${getSiteUrl()}/portal/${application.portal_access_token}/contracts/${contract.id}` : null

  return (
    <div className="content-stack">
      <section className="section-head">
        <div>
          <div className="micro">Договор #{contract.contract_number}</div>
          <h1 className="page-title">{contract.title}</h1>
          <p className="muted">Это уже не файл. Это сущность процесса со статусом, порталом и следом действий.</p>
        </div>
        <div className="form-actions">
          {contract.application_id ? <Link className="button-secondary" href={`/dashboard/participants/${contract.application_id}`}>К участнику</Link> : null}
          <Link className="button-secondary" href="/dashboard/contracts">Назад к договорам</Link>
        </div>
      </section>

      <section className="grid-2">
        <article className="card stack">
          <div className="badge-row">
            <span className="badge success">{label('contractStatus', contract.status)}</span>
            <span className="badge">{contract.template?.code || 'шаблон'}</span>
          </div>
          <h2 style={{ margin: 0 }}>Контекст договора</h2>
          <div className="grid-2">
            <div><div className="micro">Участник</div><div>{contract.application?.participant_name || '—'}</div></div>
            <div><div className="micro">Подписант</div><div>{contract.signatory_name || contract.application?.guardian_name || '—'}</div><div className="micro">{contract.signatory_email || contract.application?.guardian_email || '—'}</div></div>
            <div><div className="micro">Создан</div><div>{formatDateTime(contract.created_at)}</div></div>
            <div><div className="micro">Отправлен</div><div>{formatDateTime(contract.sent_at)}</div></div>
            <div><div className="micro">Просмотрен</div><div>{formatDateTime(contract.viewed_at)}</div></div>
            <div><div className="micro">Подписан</div><div>{formatDateTime(contract.signed_at)}</div></div>
          </div>
          {portalUrl ? <div><div className="micro">Публичный просмотр через кабинет семьи</div><pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{portalUrl}</pre></div> : null}
          <div><div className="micro">Комментарий</div><div>{contract.notes || '—'}</div></div>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Управление статусом</h2>
          <form action={updateContractStatusAction}>
            <input type="hidden" name="contract_id" value={contract.id} />
            <input type="hidden" name="application_id" value={contract.application_id} />
            <label>Новый статус<select name="status" defaultValue={contract.status}>{contractStatusOptions.map((status) => <option key={status} value={status}>{label('contractStatus', status)}</option>)}</select></label>
            <div className="form-grid">
              <label>Имя подписанта<input name="signatory_name" defaultValue={contract.signatory_name || contract.application?.guardian_name || ''} /></label>
              <label>Email подписанта<input name="signatory_email" type="email" defaultValue={contract.signatory_email || contract.application?.guardian_email || ''} /></label>
            </div>
            <label>Комментарий<textarea name="note" placeholder="Что произошло по договору" defaultValue={contract.notes || ''} /></label>
            <div className="form-actions"><button className="button">Сохранить договор</button>{portalUrl ? <a className="button-secondary" href={portalUrl} target="_blank" rel="noreferrer">Открыть как родитель</a> : null}</div>
          </form>
        </article>
      </section>

      <section className="grid-2">
        <article className="card stack"><h2 style={{ margin: 0 }}>Текст договора</h2><pre className="contract-text">{contract.rendered_text}</pre></article>
        <article className="card stack"><h2 style={{ margin: 0 }}>История действий</h2>{activities.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Событие</th><th>Комментарий</th><th>Кто</th><th>Когда</th></tr></thead><tbody>{activities.map((activity) => <tr key={activity.id}><td><div>{activity.title}</div><div className="micro">{activity.event_type}</div></td><td>{activity.body || '—'}</td><td>{activity.actor?.full_name || activity.actor?.email || 'система'}</td><td>{formatDateTime(activity.created_at)}</td></tr>)}</tbody></table></div> : <div className="muted">История договора пока пустая.</div>}</article>
      </section>
    </div>
  )
}
