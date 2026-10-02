// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RecordItem } from '../state/app-state'

const downloadPhoto = vi.fn(async (_url: string, _name: (type: string) => string) => {})
const downloadRecordPhotosPdf = vi.fn(async (_record: RecordItem, _urls: string[]) => {})

vi.mock('../server/delivery-note-photos', () => ({
  listRecordPhotos: async () => [
    { id: 'a', url: 'https://storage.test/a.jpg', createdAt: '' },
    { id: 'b', url: 'https://storage.test/b.webp', createdAt: '' },
    { id: 'c', url: null, createdAt: '' },
  ],
}))
vi.mock('../utils/photo-download', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/photo-download')>()),
  downloadPhoto: (url: string, name: (type: string) => string) => downloadPhoto(url, name),
}))
vi.mock('../utils/photo-pdf', () => ({
  downloadRecordPhotosPdf: (record: RecordItem, urls: string[]) => downloadRecordPhotosPdf(record, urls),
}))

const { RecordPhotosDialog } = await import('./record-photos-dialog')

const record = {
  id: 7,
  deliveryNoteId: 'LS-20261002-0003',
  company: 'Komfort Wohnbau',
  productName: 'LKW 26t',
  amount: 2,
  unit: 'Std.',
  constructionSiteName: 'Nordring 12',
  createdByName: 'Max',
} as RecordItem

function renderDialog() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RecordPhotosDialog record={record} onClose={() => {}} />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  downloadPhoto.mockClear()
  downloadRecordPhotosPdf.mockClear()
})

describe('RecordPhotosDialog', () => {
  it('downloads a single photo from the gallery with a numbered file name', async () => {
    renderDialog()
    const buttons = await screen.findAllByRole('button', { name: 'Herunterladen' })
    expect(buttons).toHaveLength(3)
    expect((buttons[2] as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(buttons[1])
    expect(downloadPhoto).toHaveBeenCalledWith('https://storage.test/b.webp', expect.any(Function))
    expect(downloadPhoto.mock.calls[0][1]('image/webp')).toBe('LS-20261002-0003-Foto-2.webp')
  })

  it('opens a photo large, steps through and goes back to the gallery', async () => {
    renderDialog()
    fireEvent.click(await screen.findByRole('button', { name: 'Foto 1 vergrößern' }))
    expect(screen.getByText('Foto 1 von 3')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Nächstes Foto' }))
    expect(screen.getByText('Foto 2 von 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Herunterladen' }))
    expect(downloadPhoto).toHaveBeenCalledWith('https://storage.test/b.webp', expect.any(Function))

    fireEvent.click(screen.getByRole('button', { name: 'Vorheriges Foto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Vorheriges Foto' }))
    expect(screen.getByText('Foto 3 von 3')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getAllByRole('button', { name: 'Herunterladen' })).toHaveLength(3)
  })

  it('puts every available photo into one PDF', async () => {
    renderDialog()
    fireEvent.click(await screen.findByRole('button', { name: 'Alle als PDF' }))
    expect(downloadRecordPhotosPdf).toHaveBeenCalledWith(record, ['https://storage.test/a.jpg', 'https://storage.test/b.webp'])
  })
})
