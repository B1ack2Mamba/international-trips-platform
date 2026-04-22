export const APP_ROLES = [
  'owner',
  'admin',
  'academic',
  'sales_head',
  'sales_manager',
  'backoffice',
  'finance',
  'controlling',
  'ops_manager',
  'curator',
  'marketing',
  'partner_manager',
  'sales',
  'ops',
  'partner',
  'viewer',
] as const

export type AppRole = (typeof APP_ROLES)[number]

export const STAFF_ROLES = [
  'owner',
  'admin',
  'academic',
  'sales_head',
  'sales_manager',
  'backoffice',
  'finance',
  'controlling',
  'ops_manager',
  'curator',
  'marketing',
  'partner_manager',
  'sales',
  'ops',
] as const

export const ADMIN_ROLES = ['owner', 'admin'] as const
export const PARTNER_ROLES = ['partner'] as const

export type DashboardModuleKey =
  | 'dashboard'
  | 'reports'
  | 'controlling'
  | 'leads'
  | 'my_leads'
  | 'tasks'
  | 'deals'
  | 'accounts'
  | 'scripts'
  | 'partners'
  | 'programs'
  | 'departures'
  | 'ops'
  | 'applications'
  | 'contracts'
  | 'create_payment'
  | 'communications'
  | 'finance'
  | 'settings'
  | 'spaces'

export type DashboardNavItem = {
  key: DashboardModuleKey
  href: string
  label: string
  description: string
  roles: readonly AppRole[]
}

export type DashboardNavGroup = {
  title: string
  items: readonly DashboardNavItem[]
}

export type DashboardModuleDefinition = DashboardNavItem & {
  routePath: string
  groupTitle: string
}


export const ACTIVE_DASHBOARD_MODULE_KEYS = [
  'dashboard',
  'reports',
  'spaces',
  'leads',
  'my_leads',
  'tasks',
  'deals',
  'accounts',
  'contracts',
  'scripts',
  'partners',
  'programs',
  'departures',
  'ops',
  'finance',
  'controlling',
] as const satisfies readonly DashboardModuleKey[]

const ACTIVE_DASHBOARD_MODULE_KEY_SET = new Set<DashboardModuleKey>(ACTIVE_DASHBOARD_MODULE_KEYS)

export function isActiveDashboardModuleKey(key: DashboardModuleKey) {
  return ACTIVE_DASHBOARD_MODULE_KEY_SET.has(key)
}

export type AppAbility =
  | 'lead.create'
  | 'lead.take'
  | 'lead.update'
  | 'lead.convert'
  | 'deal.create'
  | 'deal.update'
  | 'deal.application_create'
  | 'account.create'
  | 'program.create'
  | 'departure.create'
  | 'departure.update'
  | 'application.update'
  | 'application.checklist_seed'
  | 'application.document_update'
  | 'application.contract_create'
  | 'application.portal_manage'
  | 'contract.status_update'
  | 'finance.payment_create'
  | 'finance.payment_mark_paid'
  | 'controlling.expense_create'
  | 'controlling.expense_update'
  | 'script.create'
  | 'communication.queue'
  | 'communication.outbox_manage'
  | 'communication.dispatch'
  | 'partner.code_create'
  | 'partner.bind'
  | 'partner.lock_release'
  | 'ops.checklist_seed'
  | 'ops.item_create'
  | 'ops.item_update'
  | 'ops.update_create'
  | 'settings.profile_update'

function hasRole(role: string | null | undefined, allowed: readonly AppRole[]) {
  return Boolean(role && allowed.includes(role as AppRole))
}

export function isStaffRole(role?: string | null) {
  return hasRole(role, STAFF_ROLES)
}

export function isAdminRole(role?: string | null) {
  return hasRole(role, ADMIN_ROLES)
}

export function isPartnerRole(role?: string | null) {
  return hasRole(role, PARTNER_ROLES)
}

export function isPartnerOrStaffRole(role?: string | null) {
  return isPartnerRole(role) || isStaffRole(role)
}

export function isExecutiveRole(role?: string | null) {
  return hasRole(role, ['owner', 'admin'] as const)
}

export function isSalesRole(role?: string | null) {
  return hasRole(role, ['sales_head', 'sales_manager', 'sales'] as const)
}

export function isBackofficeRole(role?: string | null) {
  return hasRole(role, ['backoffice'] as const)
}

export function isFinanceRole(role?: string | null) {
  return hasRole(role, ['finance'] as const)
}

export function isControllingRole(role?: string | null) {
  return hasRole(role, ['controlling'] as const)
}

export function isOpsRole(role?: string | null) {
  return hasRole(role, ['ops_manager', 'curator', 'ops'] as const)
}

export function isAcademicRole(role?: string | null) {
  return hasRole(role, ['academic'] as const)
}

export function isMarketingRole(role?: string | null) {
  return hasRole(role, ['marketing'] as const)
}

export function isPartnerManagerRole(role?: string | null) {
  return hasRole(role, ['partner_manager'] as const)
}

const salesRoles = ['owner', 'admin', 'sales_head', 'sales_manager', 'marketing', 'partner_manager', 'sales'] as const
const backofficeRoles = ['owner', 'admin', 'backoffice', 'finance', 'ops_manager'] as const
const programRoles = ['owner', 'admin', 'academic', 'marketing', 'ops_manager'] as const
const partnerRoles = ['owner', 'admin', 'partner_manager', 'marketing', 'sales_head', 'sales_manager'] as const
const opsRoles = ['owner', 'admin', 'ops_manager', 'curator', 'backoffice', 'ops'] as const
const controllingRoles = ['owner', 'admin', 'finance', 'controlling'] as const
const financePageRoles = ['owner', 'admin', 'finance', 'controlling', 'backoffice'] as const
const paymentCreateRoles = ['owner', 'admin', 'backoffice', 'finance'] as const
const reportRoles = ['owner', 'admin', 'academic', 'sales_head', 'finance', 'controlling', 'ops_manager', 'partner_manager', 'marketing'] as const
const settingsRoles = ['owner', 'admin'] as const

const DASHBOARD_MODULES: readonly DashboardModuleDefinition[] = [
  {
    key: 'dashboard',
    routePath: '/dashboard',
    href: '/dashboard',
    label: 'Обзор',
    description: 'KPI, последние лиды, очередь задач и общая температура системы.',
    groupTitle: 'Командный мостик',
    roles: STAFF_ROLES,
  },
  {
    key: 'reports',
    routePath: '/dashboard/reports',
    href: '/dashboard/reports',
    label: 'Отчёты',
    description: 'Воронка, прибыльность, партнёры и готовность выездов.',
    groupTitle: 'Командный мостик',
    roles: reportRoles,
  },
  {
    key: 'controlling',
    routePath: '/dashboard/controlling',
    href: '/dashboard/controlling',
    label: 'Контроллинг',
    description: 'Выручка минус себестоимость и расходы = реальная прибыль.',
    groupTitle: 'Командный мостик',
    roles: controllingRoles,
  },
  {
    key: 'leads',
    routePath: '/dashboard/leads',
    href: '/dashboard/leads',
    label: 'Лиды',
    description: 'Свободный входящий поток, который ещё можно взять в работу.',
    groupTitle: 'Продажи',
    roles: salesRoles,
  },
  {
    key: 'my_leads',
    routePath: '/dashboard/my-leads',
    href: '/dashboard/my-leads',
    label: 'Мои клиенты и дела',
    description: 'Персональная очередь клиентов и ежедневные задачи менеджера.',
    groupTitle: 'Продажи',
    roles: salesRoles,
  },
  {
    key: 'tasks',
    routePath: '/dashboard/tasks',
    href: '/dashboard/tasks',
    label: 'Мои дела',
    description: 'Единый список звонков, задач и следующих касаний по клиентам и сделкам.',
    groupTitle: 'Продажи',
    roles: salesRoles,
  },
  {
    key: 'deals',
    routePath: '/dashboard/deals',
    href: '/dashboard/deals',
    label: 'Сделки',
    description: 'Коммерческие возможности, суммы и стадии дожима.',
    groupTitle: 'Продажи',
    roles: salesRoles,
  },
  {
    key: 'accounts',
    routePath: '/dashboard/accounts',
    href: '/dashboard/accounts',
    label: 'Клиенты',
    description: 'Семьи, школы, партнёры и повторные продажи без дубликатов.',
    groupTitle: 'Продажи',
    roles: [...salesRoles, 'backoffice', 'finance'] as const,
  },
  {
    key: 'scripts',
    routePath: '/dashboard/scripts',
    href: '/dashboard/scripts',
    label: 'Скрипты',
    description: 'Продажные сценарии, возражения и следующий шаг.',
    groupTitle: 'Продажи',
    roles: salesRoles,
  },
  {
    key: 'partners',
    routePath: '/dashboard/partners',
    href: '/dashboard/partners',
    label: 'Партнёры',
    description: 'Коды, ownership lock, комиссии и партнёрская воронка.',
    groupTitle: 'Партнёры и маркетинг',
    roles: partnerRoles,
  },
  {
    key: 'programs',
    routePath: '/dashboard/programs',
    href: '/dashboard/programs',
    label: 'Программы',
    description: 'Продуктовые карточки, сегменты и описание ценности.',
    groupTitle: 'Продукт и выезды',
    roles: programRoles,
  },
  {
    key: 'departures',
    routePath: '/dashboard/departures',
    href: '/dashboard/departures',
    label: 'Выезды',
    description: 'Конкретные поездки с датами, местами и ценой.',
    groupTitle: 'Продукт и выезды',
    roles: [...programRoles, 'finance', 'backoffice'] as const,
  },
  {
    key: 'ops',
    routePath: '/dashboard/ops',
    href: '/dashboard/ops',
    label: 'Операционка поездок',
    description: 'Чек-листы выезда, узкие места и готовность группы.',
    groupTitle: 'Продукт и выезды',
    roles: opsRoles,
  },
  {
    key: 'applications',
    routePath: '/dashboard/applications',
    href: '/dashboard/applications',
    label: 'Заявки',
    description: 'Участники, документы, визы, портал семьи и запуск договора.',
    groupTitle: 'Бэк-офис и семья',
    roles: [...backofficeRoles, 'sales_head', 'sales_manager'] as const,
  },
  {
    key: 'contracts',
    routePath: '/dashboard/contracts',
    href: '/dashboard/contracts',
    label: 'Договоры',
    description: 'Версии договоров, статусы отправки, просмотра и подписи.',
    groupTitle: 'Бэк-офис и семья',
    roles: [...backofficeRoles, 'sales_head'] as const,
  },
  {
    key: 'create_payment',
    routePath: '/dashboard/finance',
    href: '/dashboard/finance?create=payment',
    label: 'Создать платёж',
    description: 'Быстро выставить платёж из заявки или прямо на сделку.',
    groupTitle: 'Бэк-офис и семья',
    roles: paymentCreateRoles,
  },
  {
    key: 'communications',
    routePath: '/dashboard/communications',
    href: '/dashboard/communications',
    label: 'Коммуникации',
    description: 'Шаблоны и outbox для семьи, команды и партнёров.',
    groupTitle: 'Бэк-офис и семья',
    roles: [...backofficeRoles, 'sales_head', 'partner_manager'] as const,
  },
  {
    key: 'finance',
    routePath: '/dashboard/finance',
    href: '/dashboard/finance',
    label: 'Финансы',
    description: 'Платежи, поступления, дебиторка и факт оплат.',
    groupTitle: 'Деньги и система',
    roles: financePageRoles,
  },
  {
    key: 'settings',
    routePath: '/dashboard/settings',
    href: '/dashboard/settings',
    label: 'Настройки',
    description: 'Роли, профиль, контуры доступа и режимы работы системы.',
    groupTitle: 'Деньги и система',
    roles: settingsRoles,
  },
  {
    key: 'spaces',
    routePath: '/dashboard/spaces',
    href: '/dashboard/spaces',
    label: 'Пространства',
    description: 'Конструктор зон влияния, модулей, связей и назначений по email.',
    groupTitle: 'Деньги и система',
    roles: settingsRoles,
  },
] as const

export function getDashboardModules() {
  return DASHBOARD_MODULES.filter((item) => isActiveDashboardModuleKey(item.key))
}

export function getDashboardModule(key: DashboardModuleKey) {
  if (!isActiveDashboardModuleKey(key)) return null
  return DASHBOARD_MODULES.find((item) => item.key === key) ?? null
}

export function getDashboardModulesForPath(path: string) {
  return DASHBOARD_MODULES.filter((item) => isActiveDashboardModuleKey(item.key)).filter((item) => path === item.routePath || path.startsWith(`${item.routePath}/`))
}

export function isRoleAllowedForModule(role: string | null | undefined, key: DashboardModuleKey) {
  const module = getDashboardModule(key)
  if (!module) return false
  return hasRole(role, module.roles)
}

const NAV_GROUP_BLUEPRINT = [
  { title: 'Командный мостик', keys: ['dashboard', 'reports', 'spaces'] },
  { title: 'Продажи', keys: ['leads', 'my_leads', 'deals', 'accounts', 'contracts', 'scripts'] },
  { title: 'Партнёры', keys: ['partners'] },
  { title: 'Продукт и выезды', keys: ['programs', 'departures', 'ops'] },
  { title: 'Финансы', keys: ['finance', 'controlling'] },
] as const satisfies readonly { title: string; keys: readonly DashboardModuleKey[] }[]

export function getDashboardNavGroups(role?: string | null, allowedKeys?: readonly DashboardModuleKey[]) {
  const allowed = allowedKeys ? new Set<DashboardModuleKey>(allowedKeys) : null

  return NAV_GROUP_BLUEPRINT.map((group) => ({
    title: group.title,
    items: group.keys
      .map((key) => getDashboardModule(key))
      .filter((item): item is DashboardModuleDefinition => Boolean(item))
      .filter((item) => hasRole(role, item.roles))
      .filter((item) => !allowed || allowed.has(item.key))
      .map((item) => {
        if (item.key !== 'dashboard') return item

        return {
          ...item,
          label: isExecutiveRole(role) ? 'Общий обзор' : 'Мой рабочий стол',
          description: isExecutiveRole(role)
            ? 'KPI, прибыль, нагрузка команды и общая температура системы.'
            : 'Стартовый экран по моей функции: очередь, узкие места и быстрые переходы.',
        }
      }),
  })).filter((group) => group.items.length > 0)
}

const DASHBOARD_ROUTE_ACCESS = DASHBOARD_MODULES.reduce<Record<string, readonly AppRole[]>>((acc, item) => {
  const current = new Set<AppRole>([...(acc[item.routePath] ?? []), ...item.roles])
  acc[item.routePath] = [...current]
  return acc
}, {})

DASHBOARD_ROUTE_ACCESS['/dashboard'] = STAFF_ROLES

const roleZones: Record<string, { title: string; subtitle: string }> = {
  owner: {
    title: 'Руководство всей машиной',
    subtitle: 'Видит всю воронку, прибыль, выезды и может разруливать конфликты.',
  },
  admin: {
    title: 'Системный администратор проекта',
    subtitle: 'Управляет настройками, контуром доступа и может подменить любой процесс.',
  },
  academic: {
    title: 'Продукт и академическая программа',
    subtitle: 'Отвечает за содержание программ, партнёров по странам и ценность продукта.',
  },
  sales_head: {
    title: 'Руководитель продаж',
    subtitle: 'Контролирует лиды, сделки, конверсию и дисциплину follow-up.',
  },
  sales_manager: {
    title: 'Менеджер продаж',
    subtitle: 'Обрабатывает лиды, дожимает сделки и работает по скриптам.',
  },
  backoffice: {
    title: 'Бэк-офис',
    subtitle: 'Превращает продажу в заявку, договор, документы и готовность семьи.',
  },
  finance: {
    title: 'Финансы',
    subtitle: 'Видит платежи, дебиторку и денежный контур проекта.',
  },
  controlling: {
    title: 'Контроллинг',
    subtitle: 'Считает себестоимость, постоянные расходы и реальную чистую прибыль.',
  },
  ops_manager: {
    title: 'Руководитель выездов',
    subtitle: 'Держит готовность групп, чек-листы и узкие места по поездкам.',
  },
  curator: {
    title: 'Куратор группы',
    subtitle: 'Видит только операционный слой поездок и участников своего выезда.',
  },
  marketing: {
    title: 'Маркетинг',
    subtitle: 'Управляет источниками лидов, офферами и качеством входящего потока.',
  },
  partner_manager: {
    title: 'Партнёрский контур',
    subtitle: 'Ведёт партнёров, коды, ownership lock и расчёт комиссий.',
  },
  sales: {
    title: 'Продажи (legacy)',
    subtitle: 'Старый профиль продаж, оставлен для обратной совместимости.',
  },
  ops: {
    title: 'Операционка (legacy)',
    subtitle: 'Старый профиль ops, оставлен для обратной совместимости.',
  },
  partner: {
    title: 'Партнёр',
    subtitle: 'Видит только свой внешний кабинет и свои комиссии.',
  },
  viewer: {
    title: 'Наблюдатель',
    subtitle: 'Роль без рабочего контура внутри CRM.',
  },
}

const ABILITY_MATRIX: Record<AppAbility, readonly AppRole[]> = {
  'lead.create': ['owner', 'admin', 'sales_head', 'sales_manager', 'marketing', 'partner_manager', 'sales'],
  'lead.take': ['owner', 'admin', 'sales_head', 'sales_manager', 'sales'],
  'lead.update': ['owner', 'admin', 'sales_head', 'sales_manager', 'sales'],
  'lead.convert': ['owner', 'admin', 'sales_head', 'sales_manager', 'sales'],
  'deal.create': ['owner', 'admin', 'sales_head', 'sales_manager', 'sales'],
  'deal.update': ['owner', 'admin', 'sales_head', 'sales_manager', 'sales'],
  'deal.application_create': ['owner', 'admin', 'sales_head', 'sales_manager', 'backoffice', 'sales'],
  'account.create': ['owner', 'admin', 'sales_head', 'sales_manager', 'backoffice', 'finance', 'sales'],
  'program.create': ['owner', 'admin', 'academic'],
  'departure.create': ['owner', 'admin', 'academic', 'ops_manager'],
  'departure.update': ['owner', 'admin', 'academic', 'ops_manager'],
  'application.update': ['owner', 'admin', 'backoffice', 'ops_manager'],
  'application.checklist_seed': ['owner', 'admin', 'backoffice', 'ops_manager'],
  'application.document_update': ['owner', 'admin', 'backoffice'],
  'application.contract_create': ['owner', 'admin', 'backoffice'],
  'application.portal_manage': ['owner', 'admin', 'backoffice'],
  'contract.status_update': ['owner', 'admin', 'backoffice'],
  'finance.payment_create': ['owner', 'admin', 'backoffice', 'finance'],
  'finance.payment_mark_paid': ['owner', 'admin', 'finance'],
  'controlling.expense_create': ['owner', 'admin', 'controlling', 'finance'],
  'controlling.expense_update': ['owner', 'admin', 'controlling', 'finance'],
  'script.create': ['owner', 'admin', 'sales_head', 'sales_manager', 'sales'],
  'communication.queue': ['owner', 'admin', 'backoffice', 'sales_head', 'partner_manager'],
  'communication.outbox_manage': ['owner', 'admin', 'backoffice', 'sales_head'],
  'communication.dispatch': ['owner', 'admin', 'backoffice'],
  'partner.code_create': ['owner', 'admin', 'partner_manager'],
  'partner.bind': ['owner', 'admin', 'partner_manager'],
  'partner.lock_release': ['owner', 'admin'],
  'ops.checklist_seed': ['owner', 'admin', 'ops_manager'],
  'ops.item_create': ['owner', 'admin', 'ops_manager'],
  'ops.item_update': ['owner', 'admin', 'ops_manager', 'curator', 'ops'],
  'ops.update_create': ['owner', 'admin', 'ops_manager', 'curator', 'ops'],
  'settings.profile_update': [...STAFF_ROLES],
}

const ABILITY_GROUPS: readonly {
  title: string
  abilities: readonly AppAbility[]
}[] = [
  {
    title: 'Продажи',
    abilities: ['lead.create', 'lead.take', 'lead.update', 'lead.convert', 'deal.create', 'deal.update', 'deal.application_create', 'account.create', 'script.create'],
  },
  {
    title: 'Продукт и выезды',
    abilities: ['program.create', 'departure.create', 'departure.update', 'ops.checklist_seed', 'ops.item_create', 'ops.item_update', 'ops.update_create'],
  },
  {
    title: 'Бэк-офис',
    abilities: ['application.update', 'application.checklist_seed', 'application.document_update', 'application.contract_create', 'application.portal_manage', 'contract.status_update', 'communication.queue', 'communication.outbox_manage', 'communication.dispatch'],
  },
  {
    title: 'Деньги и партнёры',
    abilities: ['finance.payment_create', 'finance.payment_mark_paid', 'controlling.expense_create', 'controlling.expense_update', 'partner.code_create', 'partner.bind', 'partner.lock_release', 'settings.profile_update'],
  },
] as const

export function canAccessDashboardPath(role: string | null | undefined, path: string) {
  if (!isStaffRole(role)) return false

  const matchingPrefix = Object.keys(DASHBOARD_ROUTE_ACCESS)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => path === prefix || path.startsWith(`${prefix}/`))

  if (!matchingPrefix) return true
  return hasRole(role, DASHBOARD_ROUTE_ACCESS[matchingPrefix])
}

export function getRoleZone(role?: string | null) {
  return roleZones[role ?? 'viewer'] ?? roleZones.viewer
}

export function canPerform(role: string | null | undefined, ability: AppAbility) {
  return hasRole(role, ABILITY_MATRIX[ability])
}

export function canPerformAny(role: string | null | undefined, abilities: readonly AppAbility[]) {
  return abilities.some((ability) => canPerform(role, ability))
}

export function getAbilityGroups() {
  return ABILITY_GROUPS
}

export function getRoleMatrixRows() {
  return APP_ROLES.filter((role) => role !== 'viewer' && role !== 'partner').map((role) => ({
    role,
    zone: getRoleZone(role),
    groups: getDashboardNavGroups(role).map((group) => ({
      title: group.title,
      items: group.items.map((item) => item.label),
    })),
  }))
}

export function getRoleAbilityMatrixRows() {
  return APP_ROLES.filter((role) => role !== 'viewer' && role !== 'partner').map((role) => ({
    role,
    zone: getRoleZone(role),
    groups: ABILITY_GROUPS.map((group) => ({
      title: group.title,
      items: group.abilities.filter((ability) => canPerform(role, ability)).map((ability) => ability),
    })).filter((group) => group.items.length > 0),
  }))
}
