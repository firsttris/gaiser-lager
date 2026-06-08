import { useMemo, useState } from 'react'

type SelectableRecord = {
  id: number
}

export function useRecordSelection<T extends SelectableRecord>(records: T[]) {
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([])

  const selectedSet = useMemo(() => new Set(selectedRecordIds), [selectedRecordIds])
  const selectedRecords = useMemo(
    () => records.filter((record) => selectedSet.has(record.id)),
    [records, selectedSet],
  )
  const selectedCount = selectedRecords.length
  const areAllVisibleSelected = records.length > 0 && records.every((record) => selectedSet.has(record.id))

  function toggleRecordSelection(recordId: number) {
    setSelectedRecordIds((prev) => {
      if (prev.includes(recordId)) {
        return prev.filter((id) => id !== recordId)
      }

      return [...prev, recordId]
    })
  }

  function selectAllVisible() {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev)
      records.forEach((record) => next.add(record.id))
      return Array.from(next)
    })
  }

  function deselectVisible() {
    setSelectedRecordIds((prev) => prev.filter((id) => !records.some((record) => record.id === id)))
  }

  function clearSelection() {
    setSelectedRecordIds([])
  }

  return {
    selectedRecordIds,
    selectedSet,
    selectedRecords,
    selectedCount,
    areAllVisibleSelected,
    toggleRecordSelection,
    selectAllVisible,
    deselectVisible,
    clearSelection,
  }
}
