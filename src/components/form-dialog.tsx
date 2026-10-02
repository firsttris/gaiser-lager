import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Spinner } from './spinner'

// Modal for editing a record. Save/cancel sit at the top so the on-screen
// keyboard of the kiosk tablet never covers them; the content scrolls.
export function FormDialog({
  open,
  title,
  onClose,
  onSubmit,
  isSaving,
  submitLabel = 'Speichern',
  error,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  onSubmit: () => void
  isSaving: boolean
  submitLabel?: string
  error?: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-slate-200 bg-white p-5">
          <h3 className="font-title text-2xl text-slate-900">{title}</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving && <Spinner className="h-4 w-4" />}
              {submitLabel}
            </button>
          </div>
        </div>
        <div className="space-y-4 p-5">
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {children}
        </div>
      </form>
    </div>,
    document.body,
  )
}
