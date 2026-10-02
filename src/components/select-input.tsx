import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'

export type SelectOption = { value: string; label: string }

// Above this many options the list gets a search field.
const SEARCH_THRESHOLD = 8
const LIST_MAX_HEIGHT = 360
// Narrow screens (phones): the list opens as a sheet from the bottom.
const SHEET_BREAKPOINT = 640

type Props = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Classes for the closed field (spacing, width, text size), like the input fields around it. */
  className?: string
  /** Bigger option rows (kiosk flows). */
  size?: 'default' | 'large'
  placeholder?: string
  /** Title of the phone sheet and accessible name when there is no surrounding <label>. */
  label?: string
  searchable?: boolean
  disabled?: boolean
  id?: string
}

type Position = {
  left?: number
  right?: number
  minWidth: number
  maxWidth: number
  top?: number
  bottom?: number
  maxHeight: number
}

// Replaces the native <select>: the same look on every device and big touch
// targets, styled like the company search at the customer login. Opens below
// the field (above if there's no room), as a bottom sheet on phones, and is
// rendered in a portal so tables and dialogs never clip it.
export function SelectInput({
  value,
  onChange,
  options,
  className = '',
  size = 'default',
  placeholder = 'Bitte auswählen',
  label,
  searchable,
  disabled = false,
  id,
}: Props) {
  const generatedId = useId()
  const triggerId = id ?? `${generatedId}-trigger`
  const listId = `${generatedId}-list`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<Position | null>(null)
  const [isSheet, setIsSheet] = useState(false)
  const [sheetTitle, setSheetTitle] = useState('')

  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD
  const selected = options.find((option) => option.value === value)
  const visibleOptions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('de-DE')
    return needle ? options.filter((option) => option.label.toLocaleLowerCase('de-DE').includes(needle)) : options
  }, [options, query])

  function open() {
    if (disabled) return
    setQuery('')
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)))
    // Title of the phone sheet: the label prop, else the text of a
    // surrounding <label> (e.g. <label>Status <SelectInput …/></label>).
    const surroundingLabel = triggerRef.current?.closest('label')
    const labelText = [...(surroundingLabel?.childNodes ?? [])]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.trim())
      .find(Boolean)
    setSheetTitle(label ?? labelText ?? placeholder)
    setIsOpen(true)
  }

  function close(focusTrigger = true) {
    setIsOpen(false)
    setPosition(null)
    if (focusTrigger) triggerRef.current?.focus()
  }

  function choose(option: SelectOption) {
    if (option.value !== value) onChange(option.value)
    close()
  }

  // Place the list next to the field; recomputed on scroll and resize.
  useLayoutEffect(() => {
    if (!isOpen) return
    function place() {
      const sheet = window.innerWidth < SHEET_BREAKPOINT
      setIsSheet(sheet)
      if (sheet || !triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom - 12
      const spaceAbove = rect.top - 12
      const openUp = spaceBelow < 240 && spaceAbove > spaceBelow
      // As wide as the options need (at least the field); fields on the right
      // half open right-aligned so the list stays on screen.
      const alignRight = rect.left + rect.width / 2 > window.innerWidth / 2
      setPosition({
        ...(alignRight
          ? { right: window.innerWidth - rect.right, maxWidth: rect.right - 12 }
          : { left: rect.left, maxWidth: window.innerWidth - rect.left - 12 }),
        minWidth: rect.width,
        maxHeight: Math.min(LIST_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow),
        ...(openUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [isOpen])

  // Tapping anywhere outside closes the list.
  useEffect(() => {
    if (!isOpen) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isOpen])

  // Once the list is on screen (it's placed after the first render), the
  // search field or the list gets the keyboard focus.
  const isPlaced = isOpen && (isSheet || position !== null)
  useEffect(() => {
    if (!isPlaced || panelRef.current?.contains(document.activeElement)) return
    if (showSearch) searchRef.current?.focus()
    else panelRef.current?.focus()
  }, [isPlaced, showSearch])

  useEffect(() => {
    if (!isOpen) return
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [isOpen, activeIndex, listId])

  function onTriggerKeyDown(event: React.KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      open()
    }
  }

  function onListKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, visibleOptions.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(visibleOptions.length - 1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = visibleOptions[activeIndex]
      if (option) choose(option)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') {
      close(false)
    } else if (!showSearch && event.key.length === 1) {
      // Type-ahead: jump to the next option starting with the letter.
      const letter = event.key.toLocaleLowerCase('de-DE')
      const start = activeIndex + 1
      const match = [...visibleOptions.slice(start), ...visibleOptions.slice(0, start)].find((option) =>
        option.label.toLocaleLowerCase('de-DE').startsWith(letter),
      )
      if (match) setActiveIndex(visibleOptions.indexOf(match))
    }
  }

  const optionText = size === 'large' ? 'text-lg' : 'text-base'

  const list = (
    <div
      id={listId}
      role="listbox"
      aria-labelledby={triggerId}
      className="space-y-1 overflow-y-auto overscroll-contain p-2"
      style={{ maxHeight: isSheet ? '60vh' : (position?.maxHeight ?? LIST_MAX_HEIGHT) - (showSearch ? 64 : 0) }}
    >
      {visibleOptions.map((option, index) => {
        const isSelected = option.value === value
        const isActive = index === activeIndex
        return (
          <button
            key={option.value}
            id={`${listId}-${index}`}
            type="button"
            role="option"
            aria-selected={isSelected}
            tabIndex={-1}
            onClick={() => choose(option)}
            onPointerEnter={(event) => event.pointerType === 'mouse' && setActiveIndex(index)}
            className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left font-semibold transition ${optionText} ${
              isSelected
                ? 'bg-slate-900 text-white'
                : isActive
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-800 active:bg-slate-200'
            } ${isActive ? 'ring-2 ring-brand-300 ring-inset' : ''}`}
          >
            <span className="min-w-0 wrap-break-word">{option.label}</span>
            {isSelected && <Check className="h-5 w-5 shrink-0" strokeWidth={2.75} />}
          </button>
        )
      })}
      {visibleOptions.length === 0 && <p className="px-4 py-3 text-slate-600">Keine Treffer.</p>}
    </div>
  )

  const searchField = showSearch && (
    <div className="border-b border-slate-200 p-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-500" />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={onListKeyDown}
          placeholder="Suchen …"
          aria-label="Auswahl durchsuchen"
          aria-controls={listId}
          aria-activedescendant={visibleOptions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          className="w-full rounded-lg border border-slate-300 py-3 pr-3 pl-10 text-base outline-none focus:border-brand-600"
        />
      </div>
    </div>
  )

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-label={label}
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={onTriggerKeyDown}
        className={`flex items-center justify-between gap-2 border border-slate-300 bg-white text-left outline-none focus:border-slate-800 disabled:cursor-not-allowed disabled:opacity-60 ${
          /rounded/.test(className) ? '' : 'rounded-xl'
        } ${className}`}
      >
        <span className={`min-w-0 truncate ${selected ? 'text-slate-900' : 'text-slate-500'}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          strokeWidth={2.25}
        />
      </button>

      {isOpen &&
        createPortal(
          isSheet ? (
            <div className="fixed inset-0 z-[60] flex items-end bg-black/40" onClick={() => close()}>
              <div
                ref={panelRef}
                tabIndex={-1}
                onKeyDown={onListKeyDown}
                onClick={(event) => event.stopPropagation()}
                aria-activedescendant={!showSearch ? `${listId}-${activeIndex}` : undefined}
                className="w-full rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <p className="text-lg font-semibold text-slate-900">{sheetTitle}</p>
                  <button
                    type="button"
                    onClick={() => close()}
                    aria-label="Schließen"
                    className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                {searchField}
                {list}
              </div>
            </div>
          ) : (
            position && (
              <div
                ref={panelRef}
                tabIndex={-1}
                onKeyDown={onListKeyDown}
                aria-activedescendant={!showSearch ? `${listId}-${activeIndex}` : undefined}
                className="fixed z-[60] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg outline-none"
                style={{
                  left: position.left,
                  right: position.right,
                  minWidth: Math.min(position.minWidth, position.maxWidth),
                  maxWidth: position.maxWidth,
                  width: 'max-content',
                  top: position.top,
                  bottom: position.bottom,
                }}
              >
                {searchField}
                {list}
              </div>
            )
          ),
          document.body,
        )}
    </>
  )
}
