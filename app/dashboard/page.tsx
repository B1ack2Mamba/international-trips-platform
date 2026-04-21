import Link from 'next/link'
import { EmptyState } from '@/components/empty-state'
import { ProcessCenter } from '@/components/process-center'
import { KpiCard } from '@/components/kpi-card'
import { InfluenceMap } from '@/components/influence-map'
import { requireStaff } from '@/lib/auth'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { label } from '@/lib/labels'
import {
  type ContractRow,
  type DealRow,
  type LeadRow,
  type PaymentRow,
  getApplications,
  getContracts,
  getControllingExpenses,
  getControllingSummary,
  getDashboardMetrics,
  getDeals,
  getDepartureProfitability,
  getPayments,
  getPrograms,
  getRecentLeads,
  getTasks,
  getDepartures,
} from '@/lib/queries'
import {
  getRoleZone,
  isAcademicRole,
  isBackofficeRole,
  isControllingRole,
  isExecutiveRole,
  isFinanceRole,
  isMarketingRole,
  isOpsRole,
  isPartnerManagerRole,
  isSalesRole,
} from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { getAssignedWorkspaceSpaces, getWorkspaceBuilderData, type WorkspaceLink, type WorkspaceSpace } from '@/lib/influence-spaces'

export const dynamic = 'force-dynamic'

type AppSupabase = Awaited<ReturnType<typeof createClient>>

type OpsRow = {
  departure_id: string
  departure_name: string
  start_date: string | null
  end_date: string | null
  status: string | null
  program_title: string | null
  applications_count: number | null
  ops_items_total: number | null
  ops_items_done: number | null
  ops_items_open: number | null
  ops_completion_pct: number | null
}

type TripUpdateRow = {
  id: string
  title: string
  audience: string | null
  created_at: string | null
  departures: { departure_name?: string | null } | { departure_name?: string | null }[] | null
}

type PartnerPerformanceRow = {
  partner_account_id: string
  partner_name: string | null
  leads_count: number | null
  deals_count: number | null
  applications_count: number | null
  booked_amount: number | null
  commission_amount: number | null
}

type RecentPartnerLeadRow = {
  id: string
  contact_name_raw: string | null
  source_channel: string | null
  status: string
  created_at: string
  partner: { display_name: string | null } | { display_name: string | null }[] | null
}

type ChannelMetric = {
  code: string
  label: string
  count: number
}

async function countRows(supabase: AppSupabase, table: string, builder?: (query: any) => any) {
  let query: any = supabase.from(table).select('*', { count: 'exact', head: true })
  if (builder) query = builder(query)
  const { count } = await query
  return count ?? 0
}

function firstObject<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function ActionGrid({ items }: { items: { href: string; title: string; text: string }[] }) {
  return (
    <section className="grid-2">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="card stack" style={{ textDecoration: 'none' }}>
          <div style={{ fontWeight: 800, color: 'var(--text)' }}>{item.title}</div>
          <div className="micro">{item.text}</div>
        </Link>
      ))}
    </section>
  )
}

function PageHead({ title, text }: { title: string; text: string }) {
  return (
    <section className="section-head">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="muted">{text}</p>
      </div>
    </section>
  )
}

function LeadsTable({ leads, compact = false }: { leads: LeadRow[]; compact?: boolean }) {
  if (!leads.length) {
    return <EmptyState title="Пока пусто" text="Как только появятся новые входящие, они отобразятся здесь." />
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Контакт</th>
            <th>Канал</th>
            <th>Статус</th>
            {!compact ? <th>Интерес</th> : null}
            <th>Создан</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td>
                <div>{lead.contact_name_raw || 'Без имени'}</div>
                <div className="micro">{lead.phone_raw || lead.email_raw || 'Без контакта'}</div>
              </td>
              <td>{label('channel', lead.source_channel)}</td>
              <td>{label('leadStatus', lead.status)}</td>
              {!compact ? (
                <td>
                  <div>{lead.desired_program?.title || lead.desired_country || '—'}</div>
                  <div className="micro">{lead.desired_departure?.departure_name || 'Выезд не выбран'}</div>
                </td>
              ) : null}
              <td>{formatDateTime(lead.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DealsTable({ deals }: { deals: DealRow[] }) {
  if (!deals.length) {
    return <EmptyState title="Сделок пока нет" text="Когда лиды начнут конвертироваться, здесь появится живая коммерческая воронка." />
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Сделка</th>
            <th>Стадия</th>
            <th>Сумма</th>
            <th>Программа</th>
            <th>Закрытие</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr key={deal.id}>
              <td>
                <div>{deal.title}</div>
                <div className="micro">{deal.account?.display_name || deal.lead?.contact_name_raw || 'Без клиента'}</div>
              </td>
              <td>{label('dealStage', deal.stage)}</td>
              <td>{formatCurrency(deal.estimated_value, deal.currency)}</td>
              <td>
                <div>{deal.program?.title || '—'}</div>
                <div className="micro">{deal.departure?.departure_name || 'Выезд не выбран'}</div>
              </td>
              <td>{formatDate(deal.close_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PaymentsTable({ payments }: { payments: PaymentRow[] }) {
  if (!payments.length) {
    return <EmptyState title="Платежей пока нет" text="Когда появятся заявки и графики оплат, тут будет денежный контур." />
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Плательщик</th>
            <th>Назначение</th>
            <th>Сумма</th>
            <th>Срок</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td>
                <div>{payment.payer_name}</div>
                <div className="micro">{payment.deal?.title || payment.application?.participant_name || '—'}</div>
              </td>
              <td>{payment.label}</td>
              <td>{formatCurrency(payment.amount, payment.currency)}</td>
              <td>{formatDate(payment.due_date)}</td>
              <td>{label('paymentStatus', payment.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ContractsTable({ contracts }: { contracts: ContractRow[] }) {
  if (!contracts.length) {
    return <EmptyState title="Договоров пока нет" text="Когда появятся заявки и шаблоны, здесь будет юридический контур." />
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Договор</th>
            <th>Участник</th>
            <th>Статус</th>
            <th>Шаблон</th>
            <th>Создан</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => (
            <tr key={contract.id}>
              <td>
                <div>{contract.title}</div>
                <div className="micro">{contract.contract_number}</div>
              </td>
              <td>{contract.application?.participant_name || '—'}</td>
              <td>{label('contractStatus', contract.status)}</td>
              <td>{contract.template?.title || '—'}</td>
              <td>{formatDateTime(contract.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TaskTable({ tasks }: { tasks: Awaited<ReturnType<typeof getTasks>> }) {
  if (!tasks.length) {
    return <EmptyState title="Задачи пока не назначены" text="Как только воронка начнёт жить по SLA, тут появятся следующие шаги." />
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Задача</th>
            <th>Статус</th>
            <th>Приоритет</th>
            <th>Срок</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>{task.title}</td>
              <td>{label('taskStatus', task.status)}</td>
              <td>{label('priority', task.priority)}</td>
              <td>{formatDateTime(task.due_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OpsTable({ rows }: { rows: OpsRow[] }) {
  if (!rows.length) {
    return <EmptyState title="Выездов пока нет" text="Как только появятся опубликованные поездки, операционка начнёт показывать готовность." />
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Выезд</th>
            <th>Программа</th>
            <th>Участники</th>
            <th>Готовность</th>
            <th>Открытых пунктов</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.departure_id}>
              <td>
                <div>{row.departure_name}</div>
                <div className="micro">{formatDate(row.start_date)} — {formatDate(row.end_date)}</div>
              </td>
              <td>{row.program_title || '—'}</td>
              <td>{row.applications_count ?? 0}</td>
              <td>{row.ops_completion_pct ?? 0}%</td>
              <td>{row.ops_items_open ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UpdatesTable({ updates }: { updates: TripUpdateRow[] }) {
  if (!updates.length) {
    return <EmptyState title="Обновлений пока нет" text="Когда куратор начнёт писать апдейты по выездам, они будут появляться здесь." />
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Выезд</th>
            <th>Аудитория</th>
            <th>Сообщение</th>
            <th>Когда</th>
          </tr>
        </thead>
        <tbody>
          {updates.map((update) => (
            <tr key={update.id}>
              <td>{firstObject(update.departures)?.departure_name || '—'}</td>
              <td>{label('audience', update.audience || 'internal')}</td>
              <td>{update.title}</td>
              <td>{formatDateTime(update.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChannelTable({ rows }: { rows: ChannelMetric[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Канал</th>
            <th>Лидов за 30 дней</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code}>
              <td>{row.label}</td>
              <td>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

async function OwnerOverview({ spaces, globalLinks }: { spaces: WorkspaceSpace[]; globalLinks: WorkspaceLink[] }) {
  const [metrics, recentLeads, tasks] = await Promise.all([getDashboardMetrics(), getRecentLeads(8), getTasks(8)])

  return (
    <div className="content-stack">
      {spaces.length ? (
        <InfluenceMap
          spaces={spaces}
          title="Пространства влияния"
          text="Owner видит общую картину целиком: какие пространства уже созданы, какие блоки внутри и кому они назначены."
          globalLinks={globalLinks}
          compact
        />
      ) : null}
      <ProcessCenter />

      <section className="kpi-grid">
        <KpiCard label="Открытые лиды" value={metrics.openLeads} footnote="Требуют реакции продаж" />
        <KpiCard label="Активные сделки" value={metrics.activeDeals} footnote="В работе и дожиме" />
        <KpiCard label="Активные заявки" value={metrics.activeApplications} footnote="Уже в операционном контуре" />
        <KpiCard label="Платежи под контролем" value={metrics.duePayments} footnote="К оплате / частично / ожидает" />
        <KpiCard label="Сообщения в очереди" value={metrics.queuedMessages} footnote="Очередь исходящих ждёт отправки" />
        <KpiCard label="Партнёрские обязательства" value={metrics.partnerLiabilities} footnote="Ожидают / подтверждены" />
        <KpiCard label="Оплаченная выручка" value={formatCurrency(metrics.paidRevenue)} footnote="По оплаченным платежам" />
        <KpiCard label="Валовая прибыль" value={formatCurrency(metrics.grossProfit)} footnote="После себестоимости поездок" />
        <KpiCard label="Чистая прибыль" value={formatCurrency(metrics.netProfit)} footnote="После операционных расходов" />
        <KpiCard label="Продаваемые выезды" value={metrics.upcomingDepartures} footnote="Опубликованы или в продаже" />
      </section>

      <ActionGrid
        items={[
          { href: '/dashboard/reports', title: 'Управленческие отчёты', text: 'Воронка, партнёры, выезды и прибыльность в одном месте.' },
          { href: '/dashboard/controlling', title: 'Контроллинг', text: 'Разложить выручку на себестоимость, расходы и чистую прибыль.' },
          { href: '/dashboard/finance', title: 'Финансы', text: 'Проверить платежи, дебиторку и факт поступлений.' },
          { href: '/dashboard/ops', title: 'Операционка поездок', text: 'Понять, где реальная готовность группы, а где только обещания.' },
        ]}
      />

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Последние лиды</h2>
          <LeadsTable leads={recentLeads} compact />
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Открытые задачи</h2>
          <TaskTable tasks={tasks} />
        </article>
      </section>
    </div>
  )
}

async function SalesWorkspace({ profileId, head }: { profileId: string; head: boolean }) {
  const supabase = await createClient()
  const activeLeadStatuses = ['new', 'assigned', 'in_progress', 'qualified']
  const activeDealStages = ['qualified', 'proposal', 'negotiation', 'won']

  const [recentLeads, deals, tasks, openLeadsCount, activeDealsCount, unassignedLeadsCount] = await Promise.all([
    getRecentLeads(12),
    getDeals(12),
    getTasks(12),
    countRows(supabase, 'leads', (query) =>
      head ? query.in('status', activeLeadStatuses) : query.eq('owner_user_id', profileId).in('status', activeLeadStatuses),
    ),
    countRows(supabase, 'deals', (query) =>
      head ? query.in('stage', activeDealStages) : query.eq('owner_user_id', profileId).in('stage', activeDealStages),
    ),
    countRows(supabase, 'leads', (query) => query.is('owner_user_id', null).in('status', ['new', 'assigned'])),
  ])

  const visibleLeads = head ? recentLeads : recentLeads.filter((lead) => !lead.owner_user_id || lead.owner_user_id === profileId)
  const visibleDeals = head ? deals : deals.filter((deal) => !deal.owner_user_id || deal.owner_user_id === profileId)
  const visibleTasks = head ? tasks : tasks

  return (
    <div className="content-stack">
      <PageHead
        title={head ? 'Рабочий стол руководителя продаж' : 'Рабочий стол продаж'}
        text={
          head
            ? 'Здесь виден входящий поток, пробуксовка по воронке и дисциплина следующего шага по всей команде.'
            : 'Здесь менеджер держит в фокусе свои лиды, сделки, задачи и быстрые переходы для дожима.'
        }
      />

      <section className="kpi-grid">
        <KpiCard label={head ? 'Активные лиды команды' : 'Мои активные лиды'} value={openLeadsCount} footnote="Новые / назначенные / в работе / квалифицированные" />
        <KpiCard label={head ? 'Активные сделки команды' : 'Мои сделки'} value={activeDealsCount} footnote="Квалификация / предложение / переговоры / выиграно" />
        <KpiCard label="Не назначенные лиды" value={unassignedLeadsCount} footnote="Зависают без хозяина" />
        <KpiCard label="Открытые задачи" value={visibleTasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled').length} footnote="Follow-up и внутренние хвосты" />
      </section>

      <ActionGrid
        items={[
          { href: '/dashboard/leads', title: 'Лиды', text: 'Взять входящие в работу, снять дубли и поставить первый шаг.' },
          { href: '/dashboard/deals', title: 'Сделки', text: 'Дожимать воронку и переводить интерес в коммерческое обязательство.' },
          { href: '/dashboard/scripts', title: 'Скрипты', text: 'Проверить подачу оффера, возражения и формулировки звонка.' },
          { href: '/dashboard/accounts', title: 'Аккаунты', text: 'Привязать семью или школу, чтобы не плодить дублей.' },
        ]}
      />

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>{head ? 'Последние лиды по команде' : 'Лиды в моей зоне'}</h2>
          <LeadsTable leads={visibleLeads.slice(0, 8)} />
        </article>
        <article className="card stack">
          <h2 style={{ margin: 0 }}>{head ? 'Сделки команды' : 'Мои сделки'}</h2>
          <DealsTable deals={visibleDeals.slice(0, 8)} />
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Очередь задач</h2>
        <TaskTable tasks={visibleTasks.slice(0, 10)} />
      </article>
    </div>
  )
}

async function BackofficeWorkspace() {
  const supabase = await createClient()
  const [applications, contracts, docsPendingCount, portalEnabledCount, activeApplicationsCount, queuedMessagesCount] = await Promise.all([
    getApplications(12),
    getContracts(12),
    countRows(supabase, 'application_documents', (query) => query.in('status', ['requested', 'uploaded', 'rejected'])),
    countRows(supabase, 'applications', (query) => query.eq('portal_access_enabled', true).in('status', ['draft', 'docs', 'visa', 'ready'])),
    countRows(supabase, 'applications', (query) => query.in('status', ['draft', 'docs', 'visa', 'ready'])),
    countRows(supabase, 'message_outbox', (query) => query.eq('status', 'queued')),
  ])

  return (
    <div className="content-stack">
      <PageHead
        title="Рабочий стол бэк-офиса"
        text="Здесь продажа превращается в реальную заявку: документы, договоры, доступ семье и готовность к передаче в операционку."
      />

      <section className="kpi-grid">
        <KpiCard label="Активные заявки" value={activeApplicationsCount} footnote="Уже не лиды, ещё не завершённый выезд" />
        <KpiCard label="Документы на контроле" value={docsPendingCount} footnote="Запрошены, загружены или отклонены" />
        <KpiCard label="Порталы семей открыты" value={portalEnabledCount} footnote="У заявки включён доступ" />
        <KpiCard label="Сообщения в очереди" value={queuedMessagesCount} footnote="Ожидают отправки семье или команде" />
      </section>

      <ActionGrid
        items={[
          { href: '/dashboard/finance', title: 'Финансы', text: 'После установки цены в сделке сразу вести оплату и остаток по сумме.' },
          { href: '/dashboard/contracts', title: 'Договоры', text: 'Сгенерировать договор, отправить и контролировать просмотр.' },
          { href: '/dashboard/finance?create=payment', title: 'Создать платёж', text: 'Выставить платёж из заявки или сделки и передать его в финреестр.' },
          { href: '/dashboard/communications', title: 'Коммуникации', text: 'Проверить очередь писем, OTP и сервисные сообщения семье.' },
          { href: '/dashboard/accounts', title: 'Аккаунты', text: 'Уточнить семью, школу или партнёра без хаоса в карточках.' },
        ]}
      />

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Свежие заявки</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Участник</th>
                  <th>Статус</th>
                  <th>Виза</th>
                  <th>Документы</th>
                  <th>Создана</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <div>{application.participant_name}</div>
                      <div className="micro">{application.departure?.departure_name || 'Выезд не выбран'}</div>
                    </td>
                    <td>{label('applicationStatus', application.status)}</td>
                    <td>{label('visaStatus', application.visa_status)}</td>
                    <td>{application.documents_ready ? 'Готово' : 'В работе'}</td>
                    <td>{formatDateTime(application.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Последние договоры</h2>
          <ContractsTable contracts={contracts.slice(0, 8)} />
        </article>
      </section>
    </div>
  )
}

async function FinanceWorkspace() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const [payments, controlling, dueCount, overdueCount, partialCount, partnerLiabilitiesCount] = await Promise.all([
    getPayments(16),
    getControllingSummary(),
    countRows(supabase, 'payments', (query) => query.in('status', ['pending', 'due', 'partial'])),
    countRows(supabase, 'payments', (query) => query.in('status', ['pending', 'due', 'partial']).lte('due_date', today)),
    countRows(supabase, 'payments', (query) => query.eq('status', 'partial')),
    countRows(supabase, 'partner_commissions', (query) => query.in('status', ['pending', 'approved'])),
  ])

  return (
    <div className="content-stack">
      <PageHead
        title="Рабочий стол финансов"
        text="Здесь видно денежный факт: что уже пришло, что зависло, что просрочено и как это влияет на реальную прибыль проекта."
      />

      <section className="kpi-grid">
        <KpiCard label="Платежи под контролем" value={dueCount} footnote="pending / due / partial" />
        <KpiCard label="Просроченные к дате" value={overdueCount} footnote="Требуют жёсткого follow-up" />
        <KpiCard label="Частичные оплаты" value={partialCount} footnote="Нужны остатки и следующий платёж" />
        <KpiCard label="Оплаченная выручка" value={formatCurrency(controlling.paid_revenue)} footnote="Факт по paid-платежам" />
        <KpiCard label="Чистая прибыль" value={formatCurrency(controlling.net_profit)} footnote="После расходов и себестоимости" />
        <KpiCard label="Партнёрские обязательства" value={partnerLiabilitiesCount} footnote="Комиссии pending / approved" />
      </section>

      <ActionGrid
        items={[
          { href: '/dashboard/finance', title: 'Платежи', text: 'Отмечать оплату, добивать дебиторку и контролировать статусы.' },
          { href: '/dashboard/controlling', title: 'Контроллинг', text: 'Считать, что реально остаётся после себестоимости и расходов.' },
          { href: '/dashboard/contracts', title: 'Договоры', text: 'Проверить договорную базу перед финальным счётом.' },
          { href: '/dashboard/reports', title: 'Отчёты', text: 'Посмотреть картину по выездам, партнёрам и прибыли.' },
        ]}
      />

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Ближайшие и открытые платежи</h2>
        <PaymentsTable payments={payments} />
      </article>
    </div>
  )
}

async function ControllingWorkspace() {
  const [summary, expenses, profitability] = await Promise.all([
    getControllingSummary(),
    getControllingExpenses(10),
    getDepartureProfitability(8),
  ])

  return (
    <div className="content-stack">
      <PageHead
        title="Рабочий стол контроллинга"
        text="Здесь выручка раздевается до реальной прибыли: прямые затраты по выезду, операционные расходы и маржа по каждой поездке."
      />

      <section className="kpi-grid">
        <KpiCard label="Оплаченная выручка" value={formatCurrency(summary.paid_revenue)} footnote="Что реально пришло" />
        <KpiCard label="Себестоимость" value={formatCurrency(summary.cogs_total)} footnote="Прямые затраты поездок" />
        <KpiCard label="Опер. расходы" value={formatCurrency(summary.operating_expenses_total)} footnote="Команда, маркетинг, сервисы" />
        <KpiCard label="Валовая прибыль" value={formatCurrency(summary.gross_profit)} footnote="До операционных расходов" />
        <KpiCard label="Чистая прибыль" value={formatCurrency(summary.net_profit)} footnote="После всего давления расходов" />
        <KpiCard label="Постоянные расходы" value={formatCurrency(summary.fixed_expenses_total)} footnote="Давят на маржу каждый месяц" />
      </section>

      <ActionGrid
        items={[
          { href: '/dashboard/controlling', title: 'Строки контроллинга', text: 'Добавить прямые и косвенные расходы, привязать их к выезду или компании.' },
          { href: '/dashboard/finance', title: 'Финансы', text: 'Сопоставить прибыльную картину с денежным фактом и оплатами.' },
          { href: '/dashboard/departures', title: 'Выезды', text: 'Посмотреть, на какой поездке живёт маржа, а где уже дыра.' },
          { href: '/dashboard/reports', title: 'Отчёты', text: 'Проверить воронку, прибыльность и партнёрский вклад сверху.' },
        ]}
      />

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Последние строки расходов</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Строка</th>
                  <th>Контур</th>
                  <th>Характер</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>
                      <div>{expense.title}</div>
                      <div className="micro">{expense.departure?.departure_name || 'На компанию'}</div>
                    </td>
                    <td>{label('controllingExpenseKind', expense.expense_kind)}</td>
                    <td>{label('controllingExpenseNature', expense.expense_nature)}</td>
                    <td>{formatCurrency(expense.amount, expense.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Прибыльность по выездам</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Выезд</th>
                  <th>Выручка</th>
                  <th>Себестоимость</th>
                  <th>Маржа</th>
                </tr>
              </thead>
              <tbody>
                {profitability.map((row) => (
                  <tr key={row.departure_id}>
                    <td>
                      <div>{row.departure_name}</div>
                      <div className="micro">{row.applications_count} участников</div>
                    </td>
                    <td>{formatCurrency(row.paid_revenue)}</td>
                    <td>{formatCurrency(row.cogs_total)}</td>
                    <td>{row.margin_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  )
}

async function OpsWorkspace() {
  const supabase = await createClient()
  const [opsRes, updatesRes] = await Promise.all([
    supabase.from('reporting_departure_ops').select('*').order('start_date', { ascending: true }).limit(12),
    supabase
      .from('trip_updates')
      .select('id, title, audience, created_at, departures:departures(departure_name)')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const opsRows = (opsRes.data ?? []) as OpsRow[]
  const updates = (updatesRes.data ?? []) as TripUpdateRow[]
  const departuresCount = opsRows.length
  const participantsCount = opsRows.reduce((sum, row) => sum + Number(row.applications_count ?? 0), 0)
  const openItemsCount = opsRows.reduce((sum, row) => sum + Number(row.ops_items_open ?? 0), 0)
  const averageReadiness = departuresCount
    ? Math.round(opsRows.reduce((sum, row) => sum + Number(row.ops_completion_pct ?? 0), 0) / departuresCount)
    : 0

  return (
    <div className="content-stack">
      <PageHead
        title="Рабочий стол операционки выездов"
        text="Здесь видно, у какой группы всё на мази, а у какой чемодан уже едет, а документы ещё только обещают приехать."
      />

      <section className="kpi-grid">
        <KpiCard label="Выезды под управлением" value={departuresCount} footnote="Показываются в reporting_departure_ops" />
        <KpiCard label="Участники в контуре" value={participantsCount} footnote="По активным заявкам выездов" />
        <KpiCard label="Открытые ops-пункты" value={openItemsCount} footnote="То, что ещё не закрыто по чек-листам" />
        <KpiCard label="Средняя готовность" value={`${averageReadiness}%`} footnote="Средний completion по выездам" />
      </section>

      <ActionGrid
        items={[
          { href: '/dashboard/ops', title: 'Операционка поездок', text: 'Работать с чек-листами, узкими местами и готовностью выездов.' },
          { href: '/dashboard/departures', title: 'Выезды', text: 'Проверить даты, загрузку мест и базовые параметры поездки.' },
          { href: '/dashboard/finance', title: 'Финансы', text: 'Следить, сколько уже оплачено по каждой сделке и что осталось добрать.' },
          { href: '/dashboard/communications', title: 'Коммуникации', text: 'Смотреть семейные и внутренние сообщения по выездам.' },
        ]}
      />

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Готовность выездов</h2>
          <OpsTable rows={opsRows.slice(0, 8)} />
        </article>
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Последние обновления</h2>
          <UpdatesTable updates={updates} />
        </article>
      </section>
    </div>
  )
}

async function AcademicWorkspace() {
  const supabase = await createClient()
  const [programs, departures, opsRes] = await Promise.all([
    getPrograms(20),
    getDepartures(20),
    supabase.from('reporting_departure_ops').select('*').order('start_date', { ascending: true }).limit(20),
  ])

  const opsRows = (opsRes.data ?? []) as OpsRow[]
  const activePrograms = programs.length
  const upcomingDepartures = departures.filter((departure) => ['published', 'selling', 'closed'].includes(departure.status)).length
  const totalSeats = departures.reduce((sum, departure) => sum + Number(departure.seat_capacity ?? 0), 0)
  const bookedParticipants = opsRows.reduce((sum, row) => sum + Number(row.applications_count ?? 0), 0)

  return (
    <div className="content-stack">
      <PageHead
        title="Рабочий стол продукта и программ"
        text="Здесь держится смысл продукта: какие программы живые, какие выезды упакованы и где ценность ещё не оформлена в нормальный продукт."
      />

      <section className="kpi-grid">
        <KpiCard label="Активные программы" value={activePrograms} footnote="Карточки продукта в системе" />
        <KpiCard label="Выезды в продаже" value={upcomingDepartures} footnote="published / selling / closed" />
        <KpiCard label="План мест" value={totalSeats} footnote="Суммарная вместимость текущих выездов" />
        <KpiCard label="Забронированные участники" value={bookedParticipants} footnote="По активным заявкам выездов" />
      </section>

      <ActionGrid
        items={[
          { href: '/dashboard/programs', title: 'Программы', text: 'Обновить позиционирование, сегменты и публичные карточки.' },
          { href: '/dashboard/departures', title: 'Выезды', text: 'Связать даты, цену, места и реальный продуктовый запуск.' },
          { href: '/dashboard/reports', title: 'Отчёты', text: 'Понять, какие направления реально загружаются и монетизируются.' },
          { href: '/dashboard/ops', title: 'Операционка', text: 'Сверить продуктовую картину с реальной готовностью выездов.' },
        ]}
      />

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Программы</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Программа</th>
                  <th>Страна</th>
                  <th>Сегмент</th>
                  <th>Формат</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((program) => (
                  <tr key={program.id}>
                    <td>{program.title}</td>
                    <td>{program.country}</td>
                    <td>{label('segment', program.segment)}</td>
                    <td>{label('tripType', program.trip_type)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Ближайшие выезды</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Выезд</th>
                  <th>Статус</th>
                  <th>Даты</th>
                  <th>Цена</th>
                </tr>
              </thead>
              <tbody>
                {departures.slice(0, 8).map((departure) => (
                  <tr key={departure.id}>
                    <td>{departure.departure_name}</td>
                    <td>{label('departureStatus', departure.status)}</td>
                    <td>{formatDate(departure.start_date)} — {formatDate(departure.end_date)}</td>
                    <td>{formatCurrency(departure.base_price, departure.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  )
}

async function PartnerManagerWorkspace() {
  const supabase = await createClient()
  const [partnersRes, partnerLeadsRes, leadsCount, dealsCount, commissionsCount, bookedAmountRes] = await Promise.all([
    supabase.from('reporting_partner_performance').select('*').order('booked_amount', { ascending: false }).limit(10),
    supabase
      .from('leads')
      .select('id, contact_name_raw, source_channel, status, created_at, partner:accounts(display_name)')
      .not('partner_account_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10),
    countRows(supabase, 'leads', (query) => query.not('partner_account_id', 'is', null)),
    countRows(supabase, 'deals', (query) => query.not('partner_account_id', 'is', null)),
    countRows(supabase, 'partner_commissions', (query) => query.in('status', ['pending', 'approved'])),
    supabase.from('reporting_partner_performance').select('booked_amount'),
  ])

  const partners = (partnersRes.data ?? []) as PartnerPerformanceRow[]
  const partnerLeads = (partnerLeadsRes.data ?? []) as RecentPartnerLeadRow[]
  const bookedAmount = (bookedAmountRes.data ?? []).reduce(
    (sum, row) => sum + Number((row as { booked_amount?: number | null }).booked_amount ?? 0),
    0,
  )

  return (
    <div className="content-stack">
      <PageHead
        title="Рабочий стол партнёрского контура"
        text="Здесь видны коды, ownership lock, эффективность школ и посредников, а также деньги, которые им уже обещаны или ещё нужно защитить."
      />

      <section className="kpi-grid">
        <KpiCard label="Партнёрские лиды" value={leadsCount} footnote="Лиды с partner attribution" />
        <KpiCard label="Партнёрские сделки" value={dealsCount} footnote="Сделки, пришедшие через внешний канал" />
        <KpiCard label="Комиссии под контролем" value={commissionsCount} footnote="pending / approved" />
        <KpiCard label="Забронированный объём" value={formatCurrency(bookedAmount)} footnote="По витрине reporting_partner_performance" />
      </section>

      <ActionGrid
        items={[
          { href: '/dashboard/partners', title: 'Партнёры', text: 'Коды, lock, комиссии, ownership и контроль переманивания.' },
          { href: '/dashboard/leads', title: 'Лиды', text: 'Проверить, где партнёр привёл лид, а где клиент уже перешёл в систему.' },
          { href: '/dashboard/deals', title: 'Сделки', text: 'Посмотреть партнёрский след в коммерческой воронке.' },
          { href: '/dashboard/reports', title: 'Отчёты', text: 'Сравнить партнёров по качеству и выручке.' },
        ]}
      />

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Топ партнёров</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Партнёр</th>
                  <th>Лиды</th>
                  <th>Сделки</th>
                  <th>Бронь</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr key={partner.partner_account_id}>
                    <td>{partner.partner_name || '—'}</td>
                    <td>{partner.leads_count ?? 0}</td>
                    <td>{partner.deals_count ?? 0}</td>
                    <td>{formatCurrency(partner.booked_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Последние партнёрские лиды</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Контакт</th>
                  <th>Партнёр</th>
                  <th>Канал</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {partnerLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <div>{lead.contact_name_raw || 'Без имени'}</div>
                      <div className="micro">{formatDateTime(lead.created_at)}</div>
                    </td>
                    <td>{firstObject(lead.partner)?.display_name || '—'}</td>
                    <td>{label('channel', lead.source_channel || 'partner')}</td>
                    <td>{label('leadStatus', lead.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  )
}

async function MarketingWorkspace() {
  const supabase = await createClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [recentLeads, programs, websiteCount, telegramCount, partnerCount, referralCount] = await Promise.all([
    getRecentLeads(16),
    getPrograms(8),
    countRows(supabase, 'leads', (query) => query.eq('source_channel', 'website').gte('created_at', since)),
    countRows(supabase, 'leads', (query) => query.eq('source_channel', 'telegram').gte('created_at', since)),
    countRows(supabase, 'leads', (query) => query.eq('source_channel', 'partner').gte('created_at', since)),
    countRows(supabase, 'leads', (query) => query.eq('source_channel', 'referral').gte('created_at', since)),
  ])

  const channels: ChannelMetric[] = [
    { code: 'website', label: 'Сайт', count: websiteCount },
    { code: 'telegram', label: 'Telegram', count: telegramCount },
    { code: 'partner', label: 'Партнёр', count: partnerCount },
    { code: 'referral', label: 'Рекомендация', count: referralCount },
  ]

  return (
    <div className="content-stack">
      <PageHead
        title="Рабочий стол маркетинга"
        text="Здесь видно, какие каналы реально тащат живой спрос, а какие просто шумят и жрут бюджет без смысла."
      />

      <section className="kpi-grid">
        <KpiCard label="Сайт за 30 дней" value={websiteCount} footnote="Сколько лидов пришло с сайта" />
        <KpiCard label="Telegram за 30 дней" value={telegramCount} footnote="Тепловая карта канала" />
        <KpiCard label="Партнёрский канал" value={partnerCount} footnote="Сколько привели внешние источники" />
        <KpiCard label="Рекомендации" value={referralCount} footnote="Органический след доверия" />
      </section>

      <ActionGrid
        items={[
          { href: '/dashboard/leads', title: 'Лиды', text: 'Смотреть свежий входящий поток и качество карточек.' },
          { href: '/dashboard/programs', title: 'Программы', text: 'Проверять, что именно маркетинг обещает наружу.' },
          { href: '/dashboard/partners', title: 'Партнёрский канал', text: 'Сверять, кто приводит качественный трафик, а кто только забирает внимание.' },
          { href: '/dashboard/reports', title: 'Отчёты', text: 'Собирать общую картину по каналу, выручке и конверсии.' },
        ]}
      />

      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Лиды по каналам за 30 дней</h2>
          <ChannelTable rows={channels} />
        </article>

        <article className="card stack">
          <h2 style={{ margin: 0 }}>Последние входящие</h2>
          <LeadsTable leads={recentLeads.slice(0, 8)} compact />
        </article>
      </section>

      <article className="card stack">
        <h2 style={{ margin: 0 }}>Активные программы, которые сейчас продвигаются</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Программа</th>
                <th>Страна</th>
                <th>Сегмент</th>
                <th>Формат</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((program) => (
                <tr key={program.id}>
                  <td>{program.title}</td>
                  <td>{program.country}</td>
                  <td>{label('segment', program.segment)}</td>
                  <td>{label('tripType', program.trip_type)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )
}

async function GenericWorkspace({ role }: { role: string | null | undefined }) {
  const zone = getRoleZone(role)
  const [recentLeads, deals, tasks] = await Promise.all([getRecentLeads(6), getDeals(6), getTasks(6)])

  return (
    <div className="content-stack">
      <PageHead title={zone.title} text={zone.subtitle} />
      <ActionGrid
        items={[
          { href: '/dashboard', title: 'Текущая зона', text: 'Стартовый экран роли с навигацией по доступным разделам.' },
          { href: '/dashboard/reports', title: 'Отчёты', text: 'Если отчёты доступны роли, здесь видна сжатая картина процесса.' },
          { href: '/dashboard/settings', title: 'Настройки', text: 'Профиль, локаль и параметры доступа, если роль это позволяет.' },
          { href: '/dashboard/leads', title: 'Лиды', text: 'Базовый вход в систему, если роль может работать с продажей.' },
        ]}
      />
      <section className="grid-2">
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Последние лиды</h2>
          <LeadsTable leads={recentLeads} compact />
        </article>
        <article className="card stack">
          <h2 style={{ margin: 0 }}>Последние сделки</h2>
          <DealsTable deals={deals} />
        </article>
      </section>
      <article className="card stack">
        <h2 style={{ margin: 0 }}>Открытые задачи</h2>
        <TaskTable tasks={tasks} />
      </article>
    </div>
  )
}

export default async function DashboardPage() {
  const { profile } = await requireStaff()
  const role = profile?.role
  const spaces = await getAssignedWorkspaceSpaces({ id: profile!.id, email: profile?.email ?? null, role: role ?? null })

  if (isExecutiveRole(role)) {
    const builder = await getWorkspaceBuilderData()
    return <OwnerOverview spaces={builder.spaces} globalLinks={builder.globalLinks} />
  }

  let workspace: React.ReactNode

  if (isSalesRole(role)) workspace = await SalesWorkspace({ profileId: profile!.id, head: role === 'sales_head' })
  else if (isBackofficeRole(role)) workspace = await BackofficeWorkspace()
  else if (isFinanceRole(role)) workspace = await FinanceWorkspace()
  else if (isControllingRole(role)) workspace = await ControllingWorkspace()
  else if (isOpsRole(role)) workspace = await OpsWorkspace()
  else if (isAcademicRole(role)) workspace = await AcademicWorkspace()
  else if (isPartnerManagerRole(role)) workspace = await PartnerManagerWorkspace()
  else if (isMarketingRole(role)) workspace = await MarketingWorkspace()
  else workspace = await GenericWorkspace({ role })

  if (!spaces.length) return workspace

  return (
    <div className="content-stack">
      <InfluenceMap
        spaces={spaces}
        title="Мои пространства влияния"
        text="Здесь собраны именно те блоки, которые назначены тебе по email. Роль задаёт потолок действий, а пространство — состав кабинета."
        compact
      />
      {workspace}
    </div>
  )
}
