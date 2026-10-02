import { useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, X } from 'lucide-react'

// Success messages as a short notice at the bottom of the screen. Large and
// shown for 5 s, so it can be read on the kiosk tablet from a step away.
// Errors are never toasts: they stay in place (InlineMessage) until fixed.
const VISIBLE_MS = 5000

type Toast = { id: number; text: string }
let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

export function showToast(text: string) {
  const id = nextId++
  toasts = [...toasts.slice(-2), { id, text }]
  emit()
  setTimeout(() => dismissToast(id), VISIBLE_MS)
}

function dismissToast(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id)
  emit()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function Toaster() {
  const current = useSyncExternalStore(subscribe, () => toasts, () => toasts)
  if (typeof document === 'undefined' || current.length === 0) return null
  return createPortal(
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-6">
      {current.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-2xl bg-emerald-700 py-3 pr-2 pl-4 text-base font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.3)]"
        >
          <CheckCircle2 className="h-6 w-6 shrink-0" strokeWidth={2.25} />
          <span>{toast.text}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Meldung schließen"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-white/15"
          >
            <X className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}

export type Message = { kind: 'error' | 'success'; text: string } | null

// Errors stay as a red box at their place; successes become a toast.
export function InlineMessage({ message, className = '' }: { message: Message; className?: string }) {
  useEffect(() => {
    if (message?.kind === 'success') showToast(message.text)
  }, [message])
  if (message?.kind !== 'error') return null
  return (
    <p role="alert" className={`rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 ${className}`}>
      {message.text}
    </p>
  )
}

// For forms that keep their success text as a plain string.
export function SuccessToast({ text }: { text: string | null | undefined }) {
  useEffect(() => {
    if (text) showToast(text)
  }, [text])
  return null
}
