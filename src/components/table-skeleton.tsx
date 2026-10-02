// Grey placeholder rows while a list loads, so the page doesn't jump when the
// data arrives.
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Lädt…" className="mt-4 overflow-hidden rounded-xl border border-slate-100">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex animate-pulse items-center gap-4 border-b border-slate-100 bg-white px-3 py-4 last:border-b-0">
          <div className="h-7 w-7 shrink-0 rounded bg-slate-200" />
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="h-4 flex-1 rounded bg-slate-100" />
          <div className="hidden h-4 w-40 rounded bg-slate-100 sm:block" />
          <div className="h-6 w-24 rounded-md bg-slate-200" />
        </div>
      ))}
    </div>
  )
}
