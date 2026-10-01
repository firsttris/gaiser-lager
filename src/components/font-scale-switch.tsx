import { useEffect, useState } from 'react'

const STORAGE_KEY = 'gaiser-font-scale'
type FontScale = 'auto' | 'normal' | 'large' | 'xlarge'

const OPTIONS: Array<{ value: FontScale; label: string; title: string; className: string }> = [
  { value: 'normal', label: 'A', title: 'Normale Schrift', className: 'text-sm' },
  { value: 'large', label: 'A', title: 'Große Schrift', className: 'text-base' },
  { value: 'xlarge', label: 'A', title: 'Sehr große Schrift', className: 'text-lg' },
]

// Runs before hydration (inline in <head>) so the page doesn't jump in size.
export const FONT_SCALE_SCRIPT = `try{var s=localStorage.getItem('${STORAGE_KEY}');if(s&&s!=='auto')document.documentElement.dataset.fontScale=s}catch(e){}`

function readStoredScale(): FontScale {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'normal' || value === 'large' || value === 'xlarge' ? value : 'auto'
  } catch {
    return 'auto'
  }
}

function applyScale(scale: FontScale) {
  if (scale === 'auto') delete document.documentElement.dataset.fontScale
  else document.documentElement.dataset.fontScale = scale
  try {
    localStorage.setItem(STORAGE_KEY, scale)
  } catch {
    // Storage blocked (private mode): the choice just isn't remembered.
  }
}

// Text size per device: the kiosk tablet can be set to large once and keeps it.
// "auto" (nothing selected) uses the default from styles.css (larger on big
// portrait screens).
export function FontScaleSwitch() {
  const [scale, setScale] = useState<FontScale>('auto')

  useEffect(() => setScale(readStoredScale()), [])

  function choose(value: FontScale) {
    const next = value === scale ? 'auto' : value
    setScale(next)
    applyScale(next)
  }

  return (
    <div role="group" aria-label="Schriftgröße" className="inline-flex items-end gap-0.5 rounded-xl bg-slate-100 p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          aria-label={option.title}
          aria-pressed={scale === option.value}
          onClick={() => choose(option.value)}
          className={`min-w-9 rounded-lg px-2 py-1 font-bold leading-none ${option.className} ${
            scale === option.value ? 'bg-slate-900 text-white' : 'text-slate-800 hover:bg-white'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
