import { Spinner } from './spinner'

const COLOR_CLASSES = {
  amber: 'bg-amber-100 text-amber-900',
  blue: 'bg-blue-100 text-blue-900',
  red: 'bg-red-100 text-red-900',
} as const

interface Props {
  id: string
  color: keyof typeof COLOR_CLASSES
  onClick: () => void
  loading?: boolean
}

// Document number as a download button. Always the full number — the same
// one printed on the PDF and used by the search.
export function DocLinkButton({ id, color, onClick, loading = false }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={`${id} herunterladen`}
      className={`flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 font-mono text-sm whitespace-nowrap hover:opacity-75 disabled:cursor-not-allowed ${COLOR_CLASSES[color]}`}
    >
      {loading && <Spinner className="h-3 w-3" />}
      {id}
    </button>
  )
}
