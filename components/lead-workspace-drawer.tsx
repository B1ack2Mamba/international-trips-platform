import Link from 'next/link'
import type { LeadAssignableProfile } from '@/lib/lead-access'
import type { LeadRow, SalesScriptRow } from '@/lib/queries'

export function LeadWorkspaceDrawer({
  lead,
  scripts,
  scriptsMode = false,
  returnPath = '/dashboard/leads',
}: {
  lead: LeadRow
  scripts: SalesScriptRow[]
  assignableProfiles: LeadAssignableProfile[]
  scriptsMode?: boolean
  returnPath?: string
}) {
  if (!scriptsMode) return null

  return (
    <aside className="card stack deal-editor-drawer lead-scripts-drawer" id="lead-editor">
      <div className="compact-toolbar">
        <div>
          <div className="micro">Скрипты</div>
          <h2 style={{ margin: 0 }}>{lead.contact_name_raw || 'Без имени'}</h2>
          <div className="micro">Только подсказки для разговора. Действия по клиенту находятся под выбранной строкой.</div>
        </div>
        <Link className="button-secondary" href={`${returnPath}?open=${encodeURIComponent(lead.id)}`}>Закрыть</Link>
      </div>

      {scripts.length ? scripts.map((script) => (
        <div key={script.id} className="notice lead-script-card">
          <div style={{ fontWeight: 800 }}>{script.title}</div>
          <div className="micro">{script.stage}</div>
          <div>{script.body}</div>
        </div>
      )) : <div className="notice">Для этого сегмента пока нет скриптов. Можно добавить их позже в разделе «Скрипты».</div>}
    </aside>
  )
}
