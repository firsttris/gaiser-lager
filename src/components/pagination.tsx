const PAGE_SIZE_OPTIONS = [25, 50, 100]

interface Props {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  totalCount: number
  pageSize: number
  onPageSizeChange: (pageSize: number) => void
}

export function Pagination({ page, pageCount, onPageChange, totalCount, pageSize, onPageSizeChange }: Props) {
  if (totalCount === 0) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
      <div className="flex items-center gap-3">
        <p className="text-xs text-slate-600">
          {start}–{end} von {totalCount}
        </p>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          pro Seite
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-slate-800"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Zurück
        </button>
        <span className="px-1 text-xs font-semibold text-slate-800">
          Seite {page} von {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Weiter
        </button>
      </div>
    </div>
  )
}
