export function PermissionNote({
  title = 'Режим чтения',
  text,
}: {
  title?: string
  text: string
}) {
  return (
    <div className="notice">
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div>{text}</div>
    </div>
  )
}
