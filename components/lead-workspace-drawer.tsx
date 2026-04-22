import Link from 'next/link'
import { generateLeadScriptAction } from '@/app/dashboard/leads/actions'
import { formatDateTime } from '@/lib/format'
import type { LeadAssignableProfile } from '@/lib/lead-access'
import type { ActivityRow, LeadRow, SalesScriptRow } from '@/lib/queries'

export function LeadWorkspaceDrawer({
  lead,
  scripts,
  aiScript,
  scriptsMode = false,
  returnPath = '/dashboard/leads',
}: {
  lead: LeadRow
  scripts: SalesScriptRow[]
  aiScript?: ActivityRow | null
  assignableProfiles: LeadAssignableProfile[]
  scriptsMode?: boolean
  returnPath?: string
}) {
  return (
    <aside className="card stack deal-editor-drawer lead-scripts-drawer" id="lead-editor">
      <div className="compact-toolbar">
        <div>
          <div className="micro">ИИ-скрипт</div>
          <h2 style={{ margin: 0 }}>{lead.contact_name_raw || 'Без имени'}</h2>
          <div className="micro">Обновляется с учётом задач, пометок, комментариев и истории действий.</div>
        </div>
        <Link className="button-secondary" href={`${returnPath}?open=${encodeURIComponent(lead.id)}`}>Закрыть</Link>
      </div>

      <form action={generateLeadScriptAction} className="form-actions">
        <input type="hidden" name="lead_id" value={lead.id} />
        <button className="button">Обновить ИИ-скрипт</button>
      </form>

      <div id="lead-ai-script" className="notice lead-script-card lead-ai-script-card">
        <div style={{ fontWeight: 800 }}>{aiScript ? 'Актуальный скрипт' : 'Скрипт ещё не создан'}</div>
        <div className="micro">{aiScript ? `обновлён ${formatDateTime(aiScript.created_at)}` : 'нажмите «Обновить ИИ-скрипт»'}</div>
        <div>{aiScript?.body || 'ИИ подготовит персональный сценарий на основе карточки клиента, задач, комментариев и истории действий.'}</div>
      </div>

      {scriptsMode && scripts.length ? (
        <div className="stack">
          <h3 style={{ margin: 0 }}>Базовые скрипты сегмента</h3>
          {scripts.map((script) => (
            <div key={script.id} className="notice lead-script-card">
              <div style={{ fontWeight: 800 }}>{script.title}</div>
              <div className="micro">{script.stage}</div>
              <div>{script.body}</div>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
