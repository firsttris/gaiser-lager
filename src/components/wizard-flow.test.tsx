// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecentBooking } from '../server/records'

const createRecord = vi.fn()
let recentBookings: RecentBooking[] = []
let sites: { id: string; name: string; companyId: string }[] = []

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}))
vi.mock('../server/records', () => ({
  recentBookingsQueryOptions: () => ({ queryKey: ['recent'], queryFn: async () => recentBookings }),
}))
vi.mock('../server/construction-sites', () => ({
  constructionSitesQueryOptions: () => ({ queryKey: ['sites'], queryFn: async () => sites }),
}))
vi.mock('../utils/delivery-note-utils', () => ({ downloadCombinedDeliveryNote: vi.fn() }))
vi.mock('../utils/public-asset-url', () => ({ resolvePublicAssetUrl: (path: string) => path }))
vi.mock('../state/app-state', () => ({
  useAppState: () => ({
    products: [
      { id: 8, name: 'Betonrecycling', unit: 't', flow: 'pickup', price: 10, imageUrl: null },
      { id: 11, name: 'Rollkies', unit: 't', flow: 'pickup', price: 20, imageUrl: null },
      { id: 1, name: 'Betonschutt', unit: 't', flow: 'dropoff', price: 5, imageUrl: null },
    ],
    selectedCompany: { id: 'c1', name: 'Komfort Wohnbau' },
    createRecord,
    isCreatingRecord: false,
  }),
}))

const { WizardFlow } = await import('./wizard-flow')

function renderWizard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <WizardFlow flowType="pickup" />
    </QueryClientProvider>,
  )
}

const submitButton = () => screen.getByRole('button', { name: 'Vorgang anlegen' }) as HTMLButtonElement
const amountGroup = () => screen.getByRole('group', { name: 'Menge' })

beforeEach(() => {
  recentBookings = []
  sites = []
  createRecord.mockReset()
  createRecord.mockImplementation(async (input) => ({ id: 1, deliveryNoteId: 'LS-1', ...input }))
})
afterEach(cleanup)

describe('WizardFlow', () => {
  it('books a first Vorgang without history in one step: quick amount, typed site, anlegen', async () => {
    renderWizard()
    expect(screen.queryByText('Wie zuletzt')).toBeNull()
    expect(within(amountGroup()).getAllByRole('button').map((b) => b.textContent)).toEqual(['5', '10', '15', '20', '25', 'Andere …'])
    expect(submitButton().disabled).toBe(true)

    fireEvent.click(within(amountGroup()).getByRole('button', { name: '15' }))
    fireEvent.change(screen.getByLabelText('Baustelle', { selector: 'input' }), { target: { value: 'Nordring 12' } })

    expect(screen.getByText('150,00 €', { exact: false })).toBeTruthy()
    expect(submitButton().disabled).toBe(false)
    fireEvent.click(submitButton())
    expect(createRecord).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pickup', amount: 15, constructionSiteName: 'Nordring 12', product: expect.objectContaining({ id: 8 }) }),
    )
    expect(await screen.findByText('Vorgang erfolgreich angelegt')).toBeTruthy()
  })

  it('offers "Wie zuletzt", frequent amounts and recent sites as buttons', async () => {
    recentBookings = [
      { type: 'pickup', productName: 'Rollkies', amount: 12.5, unit: 't', constructionSiteName: 'Nordring 12', createdAt: '02.10.2026, 09:00' },
      { type: 'pickup', productName: 'Rollkies', amount: 12.5, unit: 't', constructionSiteName: 'Hafenstraße 3', createdAt: '01.10.2026, 09:00' },
      { type: 'dropoff', productName: 'Betonschutt', amount: 7, unit: 't', constructionSiteName: 'Ringweg 9', createdAt: '30.09.2026, 09:00' },
    ]
    sites = [{ id: 's1', name: 'Altbau Süd', companyId: 'c1' }, { id: 's2', name: 'Nordring 12', companyId: 'c1' }]
    renderWizard()

    const last = await screen.findByText('Wie zuletzt')
    const siteGroup = screen.getByRole('group', { name: 'Baustelle' })
    expect(within(siteGroup).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Nordring 12',
      'Hafenstraße 3',
      'Ringweg 9',
      'Altbau Süd',
      'Neue Baustelle',
    ])
    expect(screen.queryByLabelText('Baustelle eingeben', { selector: 'input' })).toBeNull()

    fireEvent.click(last)
    // Rollkies selected → its history amount 12,5 joins the quick picks.
    expect(within(amountGroup()).getByRole('button', { name: '12,5' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(siteGroup).getByRole('button', { name: 'Nordring 12' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('250,00 €', { exact: false })).toBeTruthy()

    fireEvent.click(submitButton())
    expect(createRecord).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 12.5, constructionSiteName: 'Nordring 12', product: expect.objectContaining({ id: 11 }) }),
    )
  })

  it('takes a custom amount from the number pad dialog', () => {
    renderWizard()
    fireEvent.click(within(amountGroup()).getByRole('button', { name: 'Andere …' }))
    const dialog = screen.getByRole('dialog')
    for (const key of ['2', '7', 'Komma', '5', '5', '5']) fireEvent.click(within(dialog).getByRole('button', { name: key }))
    expect(within(dialog).getByText('27,55')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Übernehmen' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    const custom = within(amountGroup()).getAllByRole('button').at(-1)!
    expect(custom.textContent).toBe('27,55')
    expect(custom.getAttribute('aria-pressed')).toBe('true')
  })

  it('replaces the current amount with the first key in the dialog', () => {
    renderWizard()
    fireEvent.click(within(amountGroup()).getByRole('button', { name: '20' }))
    fireEvent.click(within(amountGroup()).getByRole('button', { name: 'Andere …' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('20')).toBeTruthy()
    for (const key of ['7', 'Komma', '5']) fireEvent.click(within(dialog).getByRole('button', { name: key }))
    expect(within(dialog).getByText('7,5')).toBeTruthy()
  })

  it('opens the text field only on "Neue Baustelle" and drops a picked button site', async () => {
    sites = [{ id: 's1', name: 'Altbau Süd', companyId: 'c1' }]
    renderWizard()
    const siteGroup = await screen.findByRole('group', { name: 'Baustelle' })
    fireEvent.click(within(siteGroup).getByRole('button', { name: 'Altbau Süd' }))
    fireEvent.click(within(siteGroup).getByRole('button', { name: 'Neue Baustelle' }))

    const input = screen.getByLabelText('Baustelle eingeben', { selector: 'input' }) as HTMLInputElement
    expect(input.value).toBe('')
    expect(document.activeElement).toBe(input)
  })
})
