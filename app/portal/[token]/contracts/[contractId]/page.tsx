import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { acknowledgePortalContractAction } from '@/app/portal/actions'
import { formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import { getPortalContractByToken, getPortalSnapshotByToken } from '@/lib/queries'
import { hasPortalTokenAccess } from '@/lib/portal-auth'

export default async function PortalContractPage({ params, searchParams }: { params: Promise<{ token: string; contractId: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { token, contractId } = await params
  const query = (await searchParams) ?? {}
  const status = typeof query.status === 'string' ? query.status : ''

  const access = await hasPortalTokenAccess(token)
  if (!access.ok) {
    if (access.error === 'otp_required') {
      redirect(`/portal/access/${token}`)
    }
    notFound()
  }

  const [snapshot, contract] = await Promise.all([
    getPortalSnapshotByToken(token),
    getPortalContractByToken(token, contractId),
  ])
  if (!snapshot || !contract) notFound()

  return (
    <main className="container section">
      <section className="section-head">
        <div>
          <div className="micro">Договор семьи</div>
          <h1 className="page-title">{contract.title}</h1>
          <p className="muted">Открой, проверь данные и подтверди, что вы ознакомились с документом.</p>
        </div>
        <Link className="button-secondary" href={`/portal/${token}`}>Назад в кабинет</Link>
      </section>

      {status === 'acknowledged' ? <div className="notice">Спасибо. Ознакомление с договором зафиксировано в системе.</div> : null}

      <section className="grid-2">
        <article className="card stack">
          <div className="badge-row"><span className="badge success">{label('contractStatus', contract.status)}</span><span className="badge">{contract.contract_number}</span></div>
          <h2 style={{ margin: 0 }}>Краткий контекст</h2>
          <div className="grid-2">
            <div><div className="micro">Участник</div><div>{snapshot.application.participant_name}</div></div>
            <div><div className="micro">Родитель / подписант</div><div>{contract.signatory_name || snapshot.application.guardian_name || '—'}</div><div className="micro">{contract.signatory_email || snapshot.application.guardian_email || '—'}</div></div>
            <div><div className="micro">Создан</div><div>{formatDateTime(contract.created_at)}</div></div>
            <div><div className="micro">Последний просмотр</div><div>{formatDateTime(contract.viewed_at)}</div></div>
          </div>
          <form action={acknowledgePortalContractAction}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="contract_id" value={contract.id} />
            <div className="form-grid">
              <label>Ваше имя<input name="signatory_name" defaultValue={contract.signatory_name || snapshot.application.guardian_name || ''} required /></label>
              <label>Ваш email<input name="signatory_email" type="email" defaultValue={contract.signatory_email || snapshot.application.guardian_email || ''} /></label>
            </div>
            <label>Комментарий<textarea name="note" placeholder="Например: ознакомились, вопросов нет / нужен звонок менеджера" /></label>
            <div className="form-actions"><button className="button">Подтвердить ознакомление</button></div>
          </form>
        </article>

        <article className="card stack"><h2 style={{ margin: 0 }}>Текст договора</h2><pre className="contract-text">{contract.rendered_text}</pre></article>
      </section>
    </main>
  )
}
