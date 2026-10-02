import type { RecordStatus } from '#/lib/supabase/types'

// Records store product/truck/site names as a snapshot. Renaming in the
// master data only carries over to records that haven't been invoiced (or
// cancelled) yet — issued invoices and cancellations must keep showing
// exactly what was billed.
export const RENAMEABLE_RECORD_STATUSES: RecordStatus[] = ['offen', 'lieferschein']
