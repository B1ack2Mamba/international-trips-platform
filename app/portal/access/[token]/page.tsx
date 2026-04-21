import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/format'
import { label } from '@/lib/labels'
import { getPortalGateByToken } from '@/lib/portal-auth'
import { requestPortalCodeAction, signOutPortalAction, verifyPortalCodeAction } from './actions'

const reasonMap: Record<string, string> = {
  portal_not_available: 'Кабинет недоступен или срок ссылки истёк.',
  guardian_email_not_configured: 'У заявки не настроен email родителя. Сначала заполните его в CRM.',
  email_mismatch: 'Email не совпадает с email родителя в заявке.',
  code_not_found: 'Код не найден. Запросите новый.',
  code_expired: 'Код истёк. Запросите новый.',
  invalid_code: 'Неверный код доступа.',
}

export default async function PortalAccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { token } = await params
  const query = (await searchParams) ?? {}
  const status = typeof query.status === 'string' ? query.status : ''
  const reason = typeof query.reason === 'string' ? query.reason : ''
  const email = typeof query.email === 'string' ? query.email : ''
  const codeHint = typeof query.code_hint === 'string' ? query.code_hint : ''

  const application = await getPortalGateByToken(token)
  if (!application) notFound()

  const departureLabel = application.departure?.departure_name || 'Выезд будет уточнён'

  return (
    <main className="container section">
      <section className="grid-2">
        <article className="card stack">
          <div className="badge-row">
            <span className="badge success">Доступ в портал</span>
            <span className="badge">{label('portalAuthMode', application.portal_auth_mode)}</span>
          </div>
          <h1 className="page-title">Вход в кабинет семьи</h1>
          <p className="muted">
            Здесь можно включить доступ по одноразовому коду, чтобы кабинет не жил на одной
            вечной ссылке.
          </p>
          <div className="grid-2">
            <div>
              <div className="micro">Участник</div>
              <div>{application.participant_name}</div>
            </div>
            <div>
              <div className="micro">Родитель</div>
              <div>{application.guardian_name || '—'}</div>
              <div className="micro">{application.guardian_email || 'Email не настроен'}</div>
            </div>
            <div>
              <div className="micro">Выезд</div>
              <div>{departureLabel}</div>
            </div>
            <div>
              <div className="micro">Срок доступа</div>
              <div>{application.portal_access_expires_at ? formatDate(application.portal_access_expires_at) : 'Без ограничения'}</div>
            </div>
          </div>
          {status === 'code_sent' ? <div className="notice">Код поставлен в очередь на отправку. Проверьте inbox/outbox.</div> : null}
          {status === 'signed_out' ? <div className="notice">Сессия портала завершена.</div> : null}
          {status === 'error' ? <div className="badge danger">{reasonMap[reason] || 'Не удалось пройти верификацию.'}</div> : null}
          {codeHint ? <div className="notice">Код для режима разработки: <strong>{codeHint}</strong></div> : null}
          {application.portal_auth_mode !== 'otp_required' ? (
            <div className="notice">
              Для этой заявки OTP не обязателен. Можно сразу открыть кабинет по ссылке.{' '}
              <Link href={`/portal/${token}`}>Перейти в кабинет</Link>
            </div>
          ) : null}
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>1. Запросить код</h2>
          <form action={requestPortalCodeAction}>
            <input type="hidden" name="token" value={token} />
            <label>
              Email родителя
              <input name="email" type="email" defaultValue={email || application.guardian_email || ''} required />
            </label>
            <div className="form-actions">
              <button className="button">Отправить код</button>
            </div>
          </form>

          <h2 style={{ margin: 0 }}>2. Подтвердить код</h2>
          <form action={verifyPortalCodeAction}>
            <input type="hidden" name="token" value={token} />
            <label>
              Email родителя
              <input name="email" type="email" defaultValue={email || application.guardian_email || ''} required />
            </label>
            <label>
              Код доступа
              <input name="code" inputMode="numeric" placeholder="6 цифр" required />
            </label>
            <div className="form-actions">
              <button className="button-secondary">Войти в кабинет</button>
            </div>
          </form>

          <form action={signOutPortalAction}>
            <input type="hidden" name="token" value={token} />
            <button className="button-secondary">Сбросить текущую сессию портала</button>
          </form>
        </article>
      </section>
    </main>
  )
}
