export function WorkbarSearch({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <form className="workbar-search" action="/dashboard/search">
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder="Поиск: клиент, телефон, сделка, договор"
        aria-label="Глобальный поиск по CRM"
      />
      <button className="button-secondary" type="submit">Найти</button>
    </form>
  )
}
