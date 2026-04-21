'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export type PortalDocumentItem = {
  id: string
  code: string
  title: string
  status: string
  due_date: string | null
  file_path: string | null
  rejected_reason: string | null
  notes: string | null
}

function formatDueDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ru-RU')
}

function canUpload(status: string) {
  return !['verified', 'waived'].includes(status)
}

export function PortalDocumentUploader({
  token,
  documents,
}: {
  token: string
  documents: PortalDocumentItem[]
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, string>>({})

  async function handleFileUpload(documentId: string, file: File | null) {
    if (!file) {
      setMessages((state) => ({ ...state, [documentId]: 'Сначала выбери файл.' }))
      return
    }

    setActiveDocumentId(documentId)
    setMessages((state) => ({ ...state, [documentId]: 'Готовим защищённую ссылку для загрузки…' }))

    try {
      const prepareResponse = await fetch('/api/portal/document-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          document_id: documentId,
          filename: file.name,
        }),
      })

      const prepareJson = (await prepareResponse.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        bucket?: string
        path?: string
        token?: string
        signedUrlPath?: string
      } | null

      if (!prepareResponse.ok || !prepareJson?.ok || !prepareJson.bucket || !prepareJson.path || !prepareJson.token) {
        throw new Error(prepareJson?.error || 'Не удалось подготовить загрузку.')
      }

      setMessages((state) => ({ ...state, [documentId]: 'Загружаем файл в хранилище…' }))
      const uploadPath = prepareJson.signedUrlPath || prepareJson.path
      const { error: uploadError } = await supabase.storage
        .from(prepareJson.bucket)
        .uploadToSignedUrl(uploadPath, prepareJson.token, file)

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      setMessages((state) => ({ ...state, [documentId]: 'Фиксируем документ в системе…' }))
      const confirmResponse = await fetch('/api/portal/document-upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          document_id: documentId,
          path: prepareJson.path,
        }),
      })

      const confirmJson = (await confirmResponse.json().catch(() => null)) as {
        ok?: boolean
        error?: string
      } | null

      if (!confirmResponse.ok || !confirmJson?.ok) {
        throw new Error(confirmJson?.error || 'Файл загружен, но подтверждение не прошло.')
      }

      setMessages((state) => ({ ...state, [documentId]: 'Документ загружен. Менеджер увидит его в CRM.' }))
      router.refresh()
    } catch (error) {
      setMessages((state) => ({
        ...state,
        [documentId]: error instanceof Error ? error.message : 'Загрузка не удалась.',
      }))
    } finally {
      setActiveDocumentId(null)
    }
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Документ</th>
            <th>Срок</th>
            <th>Статус</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => {
            const isBusy = activeDocumentId === document.id
            const message = messages[document.id] || document.rejected_reason || document.notes || ''
            return (
              <tr key={document.id}>
                <td>
                  <div>{document.title}</div>
                  <div className="micro">{document.code}</div>
                  {document.file_path ? (
                    <div className="micro">
                      <Link href={`/api/portal/document-download?token=${encodeURIComponent(token)}&document_id=${document.id}`} target="_blank">
                        Открыть текущий файл
                      </Link>
                    </div>
                  ) : null}
                </td>
                <td>{formatDueDate(document.due_date)}</td>
                <td>
                  <div>{document.status}</div>
                  <div className="micro">{message || 'Ожидается обновление от менеджера.'}</div>
                </td>
                <td>
                  {canUpload(document.status) ? (
                    <label className="button-secondary" style={{ display: 'inline-flex', cursor: isBusy ? 'wait' : 'pointer', opacity: isBusy ? 0.7 : 1 }}>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        disabled={isBusy}
                        style={{ display: 'none' }}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0] ?? null
                          void handleFileUpload(document.id, file)
                          event.currentTarget.value = ''
                        }}
                      />
                      {isBusy ? 'Загрузка…' : document.file_path ? 'Заменить файл' : 'Загрузить файл'}
                    </label>
                  ) : (
                    <span className="micro">Загрузка не требуется</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
