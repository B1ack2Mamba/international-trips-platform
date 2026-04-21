export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <article className="card stack">
      <h3 style={{ margin: 0 }}>{title}</h3>
      <p className="muted" style={{ margin: 0 }}>
        {text}
      </p>
    </article>
  )
}
