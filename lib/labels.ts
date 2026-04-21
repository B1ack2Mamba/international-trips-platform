const maps = {
  role: {
    owner: 'Владелец',
    admin: 'Администратор',
    academic: 'Продукт и программы',
    sales_head: 'Руководитель продаж',
    sales_manager: 'Менеджер продаж',
    backoffice: 'Бэк-офис',
    finance: 'Финансы',
    controlling: 'Контроллинг',
    ops_manager: 'Руководитель выездов',
    curator: 'Куратор',
    marketing: 'Маркетинг',
    partner_manager: 'Партнёрский менеджер',
    sales: 'Продажи (legacy)',
    ops: 'Операционка (legacy)',
    partner: 'Партнёр',
    viewer: 'Наблюдатель',
  },
  leadStatus: {
    new: 'Новый',
    assigned: 'Назначен',
    in_progress: 'В работе',
    qualified: 'Готово',
    disqualified: 'Нецелевой',
    duplicate: 'Дубликат',
    archived: 'Архив',
  },
  dealStage: {
    qualified: 'Квалифицирована',
    proposal: 'Предложение',
    negotiation: 'Переговоры',
    won: 'Выиграна',
    lost: 'Потеряна',
  },
  accountType: {
    family: 'Семья',
    school: 'Школа',
    business: 'Бизнес',
    partner: 'Партнёр',
    vendor: 'Подрядчик',
    other: 'Другое',
  },
  accountStatus: {
    active: 'Активен',
    inactive: 'Неактивен',
    archived: 'Архив',
  },
  segment: {
    child: 'Дети',
    teen: 'Подростки',
    student: 'Студенты',
    adult: 'Взрослые',
    business: 'Бизнес',
  },
  tripType: {
    'language-immersion': 'Языковое погружение',
    'business-tour': 'Бизнес-тур',
    'conference-tour': 'Конференции и выставки',
    hybrid: 'Гибридный формат',
  },
  departureStatus: {
    draft: 'Черновик',
    published: 'Опубликован',
    selling: 'В продаже',
    closed: 'Набор закрыт',
    cancelled: 'Отменён',
    completed: 'Завершён',
  },
  applicationStatus: {
    draft: 'Черновик',
    docs: 'Документы',
    visa: 'Виза',
    ready: 'Готово к выезду',
    cancelled: 'Отменена',
    travelled: 'Поездка завершена',
  },
  visaStatus: {
    not_started: 'Не начата',
    in_progress: 'В работе',
    submitted: 'Подана',
    approved: 'Одобрена',
    rejected: 'Отказ',
    not_required: 'Не требуется',
  },
  documentStatus: {
    requested: 'Запрошен',
    uploaded: 'Загружен',
    verified: 'Проверен',
    rejected: 'Отклонён',
    waived: 'Не требуется',
  },
  paymentStatus: {
    pending: 'Ожидает',
    due: 'К оплате',
    partial: 'Частично оплачен',
    paid: 'Оплачен',
    cancelled: 'Отменён',
  },
  contractStatus: {
    draft: 'Черновик',
    ready: 'Готов к отправке',
    sent: 'Отправлен',
    viewed: 'Просмотрен',
    signed: 'Подписан',
    archived: 'Архив',
    cancelled: 'Отменён',
  },
  channel: {
    website: 'Сайт',
    partner: 'Партнёр',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    school: 'Школа',
    referral: 'Рекомендация',
    phone: 'Телефон',
    internal: 'Внутренний',
    manual: 'Вручную',
    email: 'Email',
    sms: 'SMS',
  },
  audience: {
    family: 'Семья',
    staff: 'Команда',
    internal: 'Команда',
    partner: 'Партнёр',
    system: 'Система',
  },
  priority: {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    critical: 'Критический',
  },
  taskStatus: {
    todo: 'К исполнению',
    doing: 'В работе',
    blocked: 'Заблокировано',
    done: 'Сделано',
    cancelled: 'Отменено',
  },
  opsCategory: {
    group: 'Группа',
    visa: 'Визы',
    flights: 'Перелёты',
    hotel: 'Проживание',
    insurance: 'Страховка',
    briefing: 'Брифинг',
    documents: 'Документы',
    finance: 'Финансы',
    safety: 'Безопасность',
    other: 'Другое',
  },
  lockStatus: {
    none: 'Нет',
    partner_owned: 'Закреплён за партнёром',
    released: 'Снят вручную',
  },
  portalAuthMode: {
    link: 'По прямой ссылке',
    otp_required: 'По одноразовому коду',
  },
  partnerCodeStatus: {
    active: 'Активен',
    paused: 'На паузе',
    archived: 'Архив',
  },
  outboxStatus: {
    queued: 'В очереди',
    processing: 'Отправляется',
    sent: 'Отправлено',
    failed: 'Ошибка',
    cancelled: 'Отменено',
    skipped: 'Пропущено',
  },
  commissionStatus: {
    pending: 'Ожидает согласования',
    approved: 'Подтверждена',
    paid: 'Выплачена',
    rejected: 'Отклонена',
    cancelled: 'Отменена',
  },
  controllingExpenseKind: {
    operating: 'Операционный расход',
    cogs: 'Себестоимость поездки',
  },
  controllingExpenseNature: {
    fixed: 'Постоянный',
    variable: 'Непостоянный',
  },
  controllingExpenseScope: {
    company: 'На компанию',
    departure: 'На конкретный выезд',
  },
  controllingExpenseStatus: {
    planned: 'Запланирован',
    active: 'Учтён',
    paid: 'Оплачен',
    cancelled: 'Отменён',
  },
  yesNo: {
    yes: 'Да',
    no: 'Нет',
  },
} as const

type MapName = keyof typeof maps

export function label(name: MapName, value: string | null | undefined) {
  if (!value) return '—'
  return (maps[name] as Record<string, string>)[value] ?? value
}

export function yesNo(value: boolean | null | undefined) {
  return value ? maps.yesNo.yes : maps.yesNo.no
}

export const leadStatusOptions = Object.keys(maps.leadStatus)
export const dealStageOptions = Object.keys(maps.dealStage)
export const accountTypeOptions = Object.keys(maps.accountType)
export const accountStatusOptions = Object.keys(maps.accountStatus)
export const segmentOptions = Object.keys(maps.segment)
export const tripTypeOptions = Object.keys(maps.tripType)
export const departureStatusOptions = Object.keys(maps.departureStatus)
export const applicationStatusOptions = Object.keys(maps.applicationStatus)
export const visaStatusOptions = Object.keys(maps.visaStatus)
export const documentStatusOptions = Object.keys(maps.documentStatus)
export const paymentStatusOptions = Object.keys(maps.paymentStatus)
export const contractStatusOptions = Object.keys(maps.contractStatus)
export const channelOptions = Object.keys(maps.channel)
export const audienceOptions = Object.keys(maps.audience)
export const priorityOptions = Object.keys(maps.priority)
export const taskStatusOptions = Object.keys(maps.taskStatus)
export const portalAuthModeOptions = Object.keys(maps.portalAuthMode)
export const partnerCodeStatusOptions = Object.keys(maps.partnerCodeStatus)
export const outboxStatusOptions = Object.keys(maps.outboxStatus)

export const controllingExpenseKindOptions = Object.keys(maps.controllingExpenseKind)
export const controllingExpenseNatureOptions = Object.keys(maps.controllingExpenseNature)
export const controllingExpenseScopeOptions = Object.keys(maps.controllingExpenseScope)
export const controllingExpenseStatusOptions = Object.keys(maps.controllingExpenseStatus)
