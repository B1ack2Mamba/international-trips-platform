export function KpiCard({
  label,
  value,
  footnote,
}: {
  label: string
  value: string | number
  footnote?: string
}) {
  return (
    <article className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {footnote ? <div className="micro">{footnote}</div> : null}
    </article>
  )
}
