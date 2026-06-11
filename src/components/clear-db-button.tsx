import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAppState } from '../state/app-state'
import { ConfirmDialog } from './confirm-dialog'

type Props = {
  className?: string
  compact?: boolean
}

export function ClearDbButton({ className = '', compact = false }: Props) {
  const { clearCache } = useAppState()
  const [showConfirm, setShowConfirm] = useState(false)

  const baseClasses = compact
    ? 'inline-flex w-full items-center justify-center gap-2 text-sm font-medium text-slate-400 transition hover:text-slate-700'
    : 'inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-slate-700'

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className={`${baseClasses} ${className}`.trim()}
      >
        <Trash2 className="h-4 w-4" strokeWidth={2.2} />
        DB löschen
      </button>

      <ConfirmDialog
        open={showConfirm}
        title="DB löschen"
        message="Alle lokalen Daten (Firmen, Produkte, Vorgänge) werden auf den Ausgangszustand zurückgesetzt. Der eingeloggte Benutzer bleibt erhalten."
        confirmLabel="Löschen"
        onConfirm={() => {
          clearCache()
          setShowConfirm(false)
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  )
}
