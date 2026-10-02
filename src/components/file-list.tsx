import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Files } from 'lucide-react'
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
}

const ROW_COLORS: Record<FileEntry['color'], string> = {
  amber: 'bg-amber-100 text-amber-900',
  blue: 'bg-blue-100 text-blue-900',
  red: 'bg-red-100 text-red-900',
  emerald: 'bg-emerald-100 text-emerald-900',
}

const MENU_WIDTH = 300
const GAP = 6

// The Dateien column of the lists: always one "N Dateien" button with a menu
// of every file, so rows stay one line high and look the same, even for
// Sammelrechnungen with many Lieferscheine. The menu is rendered in a portal so
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
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
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
        className="flex min-h-11 w-40 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-semibold whitespace-nowrap text-slate-800 hover:bg-slate-50"
      >
        {anyLoading ? <Spinner className="h-4 w-4" /> : <Files className="h-4 w-4" strokeWidth={2.25} />}
        {files.length} {files.length === 1 ? 'Datei' : 'Dateien'}
        <ChevronDown className={`ml-auto h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`} strokeWidth={2.25} />
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
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${ROW_COLORS[file.color]}`}>
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

