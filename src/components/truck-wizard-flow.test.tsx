// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecentBooking } from '../server/records'

const createTruckRecord = vi.fn()
let recentBookings: RecentBooking[] = []
let sites: { id: string; name: string; companyId: string }[] = []

vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }))
vi.mock('../server/records', () => ({
  recentBookingsQueryOptions: () => ({ queryKey: ['recent'], queryFn: async () => recentBookings }),
}))
vi.mock('../server/construction-sites', () => ({
  constructionSitesQueryOptions: () => ({ queryKey: ['sites'], queryFn: async () => sites }),
}))
vi.mock('../server/delivery-note-photos', () => ({ uploadDeliveryNotePhoto: vi.fn() }))
vi.mock('../utils/delivery-note-utils', () => ({ downloadCombinedDeliveryNote: vi.fn() }))
vi.mock('./delivery-note-photo-picker', () => ({ DeliveryNotePhotoPicker: () => null, releasePendingPhotos: () => {} }))
vi.mock('../state/app-state', () => ({
  useAppState: () => ({
    trucks: [
      { id: 1, name: 'LKW 18t', price: 80 },
      { id: 2, name: 'LKW 26t', price: 95 },
    ],
    createTruckRecord,
    isCreatingTruckRecord: false,
  }),
}))

const { TruckWizardFlow } = await import('./truck-wizard-flow')

const company = { id: 'c1', name: 'Komfort Wohnbau' } as Parameters<typeof TruckWizardFlow>[0]['company']

function renderWizard() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TruckWizardFlow company={company} onExit={() => {}} vorgaengeTo="/x" />
    </QueryClientProvider>,
  )
}

const submitButton = () => screen.getByRole('button', { name: 'Vorgang anlegen' }) as HTMLButtonElement
const hoursGroup = () => screen.getByRole('group', { name: 'Stunden' })

beforeEach(() => {
  recentBookings = []
  sites = []
  createTruckRecord.mockReset()
  createTruckRecord.mockImplementation(async (input) => ({ id: 1, deliveryNoteId: 'LS-1', ...input }))
})
afterEach(cleanup)

describe('TruckWizardFlow', () => {
  it('books LKW-Stunden in one step: truck tile, quick hours, new site, anlegen', async () => {
    renderWizard()
    expect(screen.queryByText('Wie zuletzt')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(within(hoursGroup()).getAllByRole('button').map((b) => b.textContent)).toEqual(['1', '2', '4', '6', '8', 'Andere …'])

    fireEvent.click(within(screen.getByRole('group', { name: 'LKW' })).getByRole('button', { name: /LKW 26t/ }))
    fireEvent.click(within(hoursGroup()).getByRole('button', { name: '4' }))
    expect(screen.getByText('380,00 €', { exact: false })).toBeTruthy()
    expect(screen.getByText('Baustelle fehlt')).toBeTruthy()
    expect(submitButton().disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Baustelle wählen …' }))
    fireEvent.change(screen.getByLabelText('Baustelle suchen oder neu eingeben'), { target: { value: 'Nordring 12' } })
    fireEvent.click(screen.getByRole('button', { name: '„Nordring 12“ als neue Baustelle anlegen' }))

    fireEvent.click(submitButton())
    expect(createTruckRecord).toHaveBeenCalledWith(
      expect.objectContaining({ hours: 4, constructionSiteName: 'Nordring 12', truck: expect.objectContaining({ id: 2 }) }),
    )
    expect(await screen.findByText('Vorgang erfolgreich angelegt')).toBeTruthy()
  })

  it('offers "Wie zuletzt" from the last LKW booking and learns the usual hours', async () => {
    recentBookings = [
      { type: 'pickup', productName: 'Rollkies', amount: 12.5, unit: 't', constructionSiteName: 'Hafenstraße 3', createdAt: '' },
      { type: 'lkw', productName: 'LKW 26t', amount: 3.5, unit: 'Std.', constructionSiteName: 'nordring 12', createdAt: '02.10.2026, 09:00' },
      { type: 'lkw', productName: 'LKW 26t', amount: 3.5, unit: 'Std.', constructionSiteName: 'Hafenstraße 3', createdAt: '01.10.2026, 09:00' },
    ]
    sites = [
      { id: 's1', name: 'Hafenstraße 3', companyId: 'c1' },
      { id: 's2', name: 'Nordring 12', companyId: 'c1' },
    ]
    renderWizard()

    const last = await screen.findByText('Wie zuletzt')
    expect(last.parentElement?.textContent).toContain('3,5 Std. LKW 26t · nordring 12')
    await within(screen.getByRole('group', { name: 'Baustelle' })).findByRole('button', { name: 'Nordring 12' })
    fireEvent.click(last)

    expect(within(screen.getByRole('group', { name: 'LKW' })).getByRole('button', { name: /LKW 26t/ }).getAttribute('aria-pressed')).toBe('true')
    expect(within(hoursGroup()).getByRole('button', { name: '3,5' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(screen.getByRole('group', { name: 'Baustelle' })).getByRole('button', { name: 'Nordring 12' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('332,50 €', { exact: false })).toBeTruthy()

    fireEvent.click(submitButton())
    expect(createTruckRecord).toHaveBeenCalledWith(
      expect.objectContaining({ hours: 3.5, constructionSiteName: 'Nordring 12', truck: expect.objectContaining({ id: 2 }) }),
    )
  })

  it('takes custom hours from the number pad', () => {
    renderWizard()
    fireEvent.click(within(hoursGroup()).getByRole('button', { name: 'Andere …' }))
    const dialog = screen.getByRole('dialog')
    for (const key of ['7', 'Komma', '5']) fireEvent.click(within(dialog).getByRole('button', { name: key }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Übernehmen' }))
    expect(within(hoursGroup()).getAllByRole('button').at(-1)!.textContent).toBe('7,5')
  })
})
