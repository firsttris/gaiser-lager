import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Mail, Paperclip, XCircle } from 'lucide-react'
import { adminPrepareInvoiceEmails, adminSendInvoiceEmail } from '../server/invoice-email'
import { formatBerlinDateTime } from '../utils/berlin-time'
import { Spinner } from './spinner'

type RowStatus = { state: 'sending' } | { state: 'sent' } | { state: 'failed'; message: string }

// Preview and send selected invoices by e-mail. Nothing goes out before the
// admin confirms; invoices are sent one by one so the progress is visible
// and a single failure doesn't stop the rest.
export function InvoiceEmailDialog({
  invoiceIds,
  onClose,
  onSent,
}: {
  invoiceIds: string[]
  onClose: () => void
  onSent: () => void
}) {
  const prepareQuery = useQuery({
    queryKey: ['invoice-email-prepare', invoiceIds] as const,
    queryFn: () => adminPrepareInvoiceEmails({ data: { invoiceIds } }),
    staleTime: 0,
    gcTime: 0,
  })
  const prepared = prepareQuery.data
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({})
  const [isSending, setIsSending] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)

  // Default: everything sendable that wasn't sent before.
  useEffect(() => {
    if (prepared && selected === null) {
      setSelected(new Set(prepared.items.filter((item) => !item.blocking && !item.lastSentAt).map((item) => item.invoiceId)))
    }
  }, [prepared, selected])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSending) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSending, onClose])

  const settingsReady = prepared !== undefined && prepared.settingsProblems.length === 0
  const toSend = prepared?.items.filter((item) => selected?.has(item.invoiceId) && !item.blocking && statuses[item.invoiceId]?.state !== 'sent') ?? []
  const isDone = Object.keys(statuses).length > 0 && !isSending
  const sentCount = Object.values(statuses).filter((status) => status.state === 'sent').length
  const failedCount = Object.values(statuses).filter((status) => status.state === 'failed').length

  function toggle(invoiceId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(invoiceId)) next.delete(invoiceId)
      else next.add(invoiceId)
      return next
    })
  }

  async function sendAll() {
    setIsSending(true)
    for (const item of toSend) {
      setStatuses((current) => ({ ...current, [item.invoiceId]: { state: 'sending' } }))
      let status: RowStatus
      try {
        const result = await adminSendInvoiceEmail({ data: { invoiceId: item.invoiceId } })
        status = result.ok ? { state: 'sent' } : { state: 'failed', message: result.message }
      } catch {
        status = { state: 'failed', message: 'Verbindung zum Server fehlgeschlagen.' }
      }
      setStatuses((current) => ({ ...current, [item.invoiceId]: status }))
    }
    setIsSending(false)
    onSent()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div role="dialog" aria-modal="true" aria-label="Rechnungen per E-Mail senden" className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <h2 className="font-title text-3xl text-slate-900">Rechnungen per E-Mail senden</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-60"
            >
              {isDone ? 'Schließen' : 'Abbrechen'}
            </button>
            {!isDone && (
              <button
                type="button"
                onClick={() => void sendAll()}
                disabled={!settingsReady || toSend.length === 0 || isSending}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? <Spinner className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                {toSend.length === 1 ? '1 Rechnung senden' : `${toSend.length} Rechnungen senden`}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4 p-5">
          {!prepared ? (
            <div className="flex justify-center py-10">
              {prepareQuery.isError ? (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Vorschau konnte nicht geladen werden.</p>
              ) : (
                <Spinner className="h-8 w-8 text-slate-400" />
              )}
            </div>
          ) : (
            <>
              {prepared.settingsProblems.length > 0 && (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  E-Mail-Versand ist noch nicht eingerichtet: {prepared.settingsProblems.join(', ')}.{' '}
                  <Link to="/admin/e-mail" className="font-semibold underline">
                    Zu den E-Mail-Einstellungen
                  </Link>
                </p>
              )}
              {prepared.mailpitUrl && (
                <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                  Lokale Entwicklung: Die Mails landen in Mailpit ({prepared.mailpitUrl}), nicht bei den Kunden.
                </p>
              )}
              {isDone && (
                <p className={`rounded-xl p-3 text-sm font-semibold ${failedCount ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-700'}`}>
                  {sentCount} gesendet{failedCount ? `, ${failedCount} fehlgeschlagen` : ''}.
                </p>
              )}
              <p className="text-sm text-slate-700">
                Von {prepared.fromAddress || '—'}
                {prepared.bcc && <> · Kopie (BCC) an {prepared.bcc}</>}
              </p>

              <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                {prepared.items.map((item) => {
                  const status = statuses[item.invoiceId]
                  const isOpen = previewId === item.invoiceId
                  return (
                    <li key={item.invoiceId} className="p-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <input
                          type="checkbox"
                          aria-label={`${item.invoiceId} senden`}
                          checked={!item.blocking && (selected?.has(item.invoiceId) ?? false)}
                          disabled={Boolean(item.blocking) || isSending || status?.state === 'sent'}
                          onChange={() => toggle(item.invoiceId)}
                          className="mt-1 h-5 w-5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900">
                            {item.invoiceId} · {item.companyName}
                          </p>
                          <p className="text-sm text-slate-700">an {item.recipient || '—'}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-semibold">
                            {item.blocking && <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-red-700">{item.blocking}</span>}
                            {item.lastSentAt && (
                              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-800">
                                bereits gesendet am {formatBerlinDateTime(item.lastSentAt)}
                              </span>
                            )}
                            {item.eInvoiceProblems.map((problem) => (
                              <span key={problem} className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-800">
                                keine E-Rechnung: {problem}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {status?.state === 'sending' && <Spinner className="h-5 w-5 text-slate-500" />}
                          {status?.state === 'sent' && (
                            <span className="flex items-center gap-1 text-sm font-semibold text-emerald-700">
                              <CheckCircle2 className="h-5 w-5" /> gesendet
                            </span>
                          )}
                          {status?.state === 'failed' && (
                            <span className="flex items-center gap-1 text-sm font-semibold text-red-700">
                              <XCircle className="h-5 w-5" /> Fehler
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setPreviewId(isOpen ? null : item.invoiceId)}
                            className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-200"
                          >
                            Vorschau {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      {status?.state === 'failed' && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 p-2 text-sm text-red-700">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {status.message}
                        </p>
                      )}
                      {isOpen && (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="font-semibold text-slate-900">{item.subject}</p>
                          <p className="mt-2 text-sm whitespace-pre-wrap text-slate-800">{item.text}</p>
                          <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-sm text-slate-700">
                            <Paperclip className="h-4 w-4" />
                            Rechnung {item.invoiceId} als PDF{item.eInvoiceProblems.length ? '' : ' (E-Rechnung, ZUGFeRD)'}
                          </p>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
