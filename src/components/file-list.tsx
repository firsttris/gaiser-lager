import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Camera, ChevronDown } from 'lucide-react'
import { Spinner } from './spinner'

export type FileEntry = {
  key: string
  /** Document number, or e.g. "3 Fotos". */
  label: string
  /** What it is, shown in the menu ("Lieferschein", "Rechnung", …). */
  kind: string
  color: 'amber' | 'blue' | 'red' | 'emerald'
  onClick: () => void
  loading?: boolean
  icon?: ReactNode
  /** How many items this entry stands for (e.g. photos); default 1. */
  count?: number
}

const ROW_COLORS: Record<FileEntry['color'], string> = {
  amber: 'bg-amber-100 text-amber-900',
  blue: 'bg-blue-100 text-blue-900',
  red: 'bg-red-100 text-red-900',
  emerald: 'bg-emerald-100 text-emerald-900',
}

// One badge per kind of file, in this order; the colour identifies the kind.
const BADGES: { color: FileEntry['color']; short: string; className: string }[] = [
  { color: 'amber', short: 'LS', className: 'bg-amber-100 text-amber-900 ring-amber-200' },
  { color: 'blue', short: 'RE', className: 'bg-blue-100 text-blue-900 ring-blue-200' },
  { color: 'red', short: 'ST', className: 'bg-red-100 text-red-900 ring-red-200' },
  { color: 'emerald', short: '', className: 'bg-emerald-100 text-emerald-900 ring-emerald-200' },
]

const MENU_WIDTH = 300
const GAP = 6

// The Dateien column of the lists: one small badge per kind of file (LS, RE,
// ST, photos — at most four, "LS ×12" for a Sammelrechnung) as a single tap
// target that opens a menu of every file. Shows at a glance what exists
// without letting the row grow. The menu is rendered in a portal so
// the table never clips it.
export function FileList({ files }: { files: FileEntry[] }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null)

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const width = Math.min(MENU_WIDTH, window.innerWidth - 16)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const spaceBelow = window.innerHeight - rect.bottom - GAP - 8
    const spaceAbove = rect.top - GAP - 8
    setPosition(
      spaceBelow >= 240 || spaceBelow >= spaceAbove
        ? { left, top: rect.bottom + GAP, maxHeight: spaceBelow }
        : { left, bottom: window.innerHeight - rect.top + GAP, maxHeight: spaceAbove },
    )
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const close = () => setIsOpen(false)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
        triggerRef.current?.focus()
      }
    }
    // Scrolling inside the menu is fine; scrolling the page would detach it.
    const onScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [isOpen])

  if (files.length === 0) return null
  const anyLoading = files.some((file) => file.loading)

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={files.map((file) => file.label).join(', ')}
        aria-label={`Dateien: ${files.map((file) => file.label).join(', ')}`}
        className={`cell-trigger -mx-2 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 whitespace-nowrap transition hover:bg-slate-900/5 ${isOpen ? 'bg-slate-900/5' : ''}`}
      >
        {BADGES.map((badge) => {
          const ofKind = files.filter((file) => file.color === badge.color)
          if (!ofKind.length) return null
          const count = ofKind.reduce((sum, file) => sum + (file.count ?? 1), 0)
          return (
            <span
              key={badge.color}
              className={`pill rounded-md font-bold tracking-wide ring-1 ring-inset ${badge.className}`}
            >
              {badge.short || <Camera className="h-3.5 w-3.5" strokeWidth={2.5} />}
              {(count > 1 || !badge.short) && <span className="font-semibold">{badge.short ? `×${count}` : count}</span>}
            </span>
          )
        })}
        {anyLoading ? (
          <Spinner className="h-4 w-4" />
        ) : (
          <ChevronDown className={`h-4 w-4 text-slate-500 transition ${isOpen ? 'rotate-180' : ''}`} strokeWidth={2.25} />
        )}
      </button>
      {isOpen &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ left: position.left, top: position.top, bottom: position.bottom, width: Math.min(MENU_WIDTH, window.innerWidth - 16), maxHeight: position.maxHeight }}
            className="fixed z-50 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
          >
            <p className="px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Dateien ({files.length})
            </p>
            {files.map((file) => (
              <button
                key={file.key}
                type="button"
                role="menuitem"
                disabled={file.loading}
                onClick={() => {
                  setIsOpen(false)
                  file.onClick()
                }}
                className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed"
              >
                <span className={`pill shrink-0 rounded-md ${ROW_COLORS[file.color]}`}>
                  {file.icon}
                  {file.kind}
                </span>
                <span className={`min-w-0 flex-1 truncate text-sm text-slate-900 ${file.icon ? '' : 'font-mono'}`}>{file.label}</span>
                {file.loading && <Spinner className="h-4 w-4" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}

