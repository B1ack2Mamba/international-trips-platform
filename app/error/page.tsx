import Link from 'next/link'

export default async function ErrorPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const message = typeof params.message === 'string' ? params.message : 'Произошла ошибка.'

  return (
    <main className="container section">
      <div className="card stack">
        <div className="badge danger">Ошибка</div>
        <h1 className="page-title">Что-то пошло не так</h1>
        <p className="muted">{message}</p>
        <div className="form-actions">
          <Link className="button" href="/login">
            Вернуться ко входу
          </Link>
          <Link className="button-secondary" href="/">
            На главную
          </Link>
        </div>
      </div>
    </main>
  )
}
