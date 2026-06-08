import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type FlowType = 'pickup' | 'dropoff'

export type Company = {
  id: string
  shortCode: string
  name: string
  pin: string
}

export type Product = {
  id: number
  name: string
  unit: string
  flow: FlowType
  pickupPrice: number
  dropoffPrice: number
}

export type RecordItem = {
  id: number
  company: string
  type: FlowType
  productName: string
  amount: number
  unit: string
  unitPrice: number
  total: number
  note: string
  status: string
  createdAt: string
}

type LoginResult = { ok: true } | { ok: false; message: string }

type CreateRecordInput = {
  type: FlowType
  product: Product
  amount: number
  note: string
}

type AppState = {
  companies: Company[]
  selectedCompany: Company | null
  isLoggedIn: boolean
  products: Product[]
  records: RecordItem[]
  login: (companyId: string, pin: string) => LoginResult
  logout: () => void
  createRecord: (input: CreateRecordInput) => void
  updateProduct: (productId: number, field: keyof Product, value: string) => void
}

const companiesSeed: Company[] = [
  { id: 'kr', shortCode: 'KR', name: 'Kramfahrt GmbH', pin: '1234' },
  { id: 'be', shortCode: 'BE', name: 'Bergbau Erden AG', pin: '2468' },
  { id: 'no', shortCode: 'NO', name: 'Nordstein Bau', pin: '7777' },
  { id: 'wa', shortCode: 'WA', name: 'Walter Tiefbau KG', pin: '2222' },
]

const productsSeed: Product[] = [
  // Annahme → Material bringen (dropoff)
  { id: 1,  name: 'Unbewehrter Betonschutt, Pflastersteine, Stahlbeton', unit: 't',  flow: 'dropoff', pickupPrice: 0, dropoffPrice: 8 },
  { id: 3,  name: 'Stark bewehrter Betonschutt',              unit: 't',  flow: 'dropoff', pickupPrice: 0, dropoffPrice: 45 },
  { id: 4,  name: 'Bituminöser Straßenaufbruch',              unit: 't',  flow: 'dropoff', pickupPrice: 0, dropoffPrice: 15 },
  { id: 5,  name: 'Gemischter Bauschutt',                     unit: 't',  flow: 'dropoff', pickupPrice: 0, dropoffPrice: 25 },
  { id: 6,  name: 'Aushub',                                   unit: 't',  flow: 'dropoff', pickupPrice: 0, dropoffPrice: 40 },
  { id: 7,  name: 'Aushub mit Bauschutt o.ä. vermischt',      unit: 'm³', flow: 'dropoff', pickupPrice: 0, dropoffPrice: 60 },
  // Verkauf → Material holen (pickup)
  { id: 8,  name: 'Betonrecycling 0/45 FSS-STS',              unit: 't',  flow: 'pickup', pickupPrice: 8,    dropoffPrice: 0 },
  { id: 9,  name: 'Bauschuttrecycling 0/56',                  unit: 't',  flow: 'pickup', pickupPrice: 0,    dropoffPrice: 0 },
  { id: 10, name: 'Gesiebt Mutterboden',                      unit: 't',  flow: 'pickup', pickupPrice: 8.5,  dropoffPrice: 0 },
  { id: 11, name: 'Rollkies 8/16',                            unit: 't',  flow: 'pickup', pickupPrice: 24.2, dropoffPrice: 0 },
  { id: 12, name: 'Mischkies 0/16',                           unit: 't',  flow: 'pickup', pickupPrice: 25.3, dropoffPrice: 0 },
  { id: 13, name: 'Sand 0/2',                                 unit: 't',  flow: 'pickup', pickupPrice: 24.4, dropoffPrice: 0 },
  { id: 14, name: 'Schwemmsand',                              unit: 't',  flow: 'pickup', pickupPrice: 15.5, dropoffPrice: 0 },
  { id: 15, name: 'Mineralgemisch 0/16',                      unit: 't',  flow: 'pickup', pickupPrice: 16.7, dropoffPrice: 0 },
  { id: 16, name: 'Mineralgemisch 0/32',                      unit: 't',  flow: 'pickup', pickupPrice: 15.1, dropoffPrice: 0 },
  { id: 17, name: 'Splitt 2/5',                               unit: 't',  flow: 'pickup', pickupPrice: 20.4, dropoffPrice: 0 },
]

const AppStateContext = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [products, setProducts] = useState<Product[]>(productsSeed)
  const [records, setRecords] = useState<RecordItem[]>([])

  const value = useMemo<AppState>(
    () => ({
      companies: companiesSeed,
      selectedCompany,
      isLoggedIn: selectedCompany !== null,
      products,
      records,
      login: (companyId: string, pin: string) => {
        const company = companiesSeed.find((item) => item.id === companyId)
        if (!company) {
          return { ok: false, message: 'Bitte waehle eine Firma aus.' }
        }

        if (company.pin !== pin) {
          return { ok: false, message: 'PIN ist falsch.' }
        }

        setSelectedCompany(company)
        return { ok: true }
      },
      logout: () => {
        setSelectedCompany(null)
      },
      createRecord: ({ type, product, amount, note }: CreateRecordInput) => {
        if (!selectedCompany) return

        const unitPrice = type === 'pickup' ? product.pickupPrice : product.dropoffPrice
        const total = unitPrice * amount
        const nextRecord: RecordItem = {
          id: Date.now(),
          company: selectedCompany.name,
          type,
          productName: product.name,
          amount,
          unit: product.unit,
          unitPrice,
          total,
          note,
          status: 'offen',
          createdAt: new Date().toLocaleString('de-DE'),
        }

        setRecords((prev) => [nextRecord, ...prev])
      },
      updateProduct: (productId: number, field: keyof Product, value: string) => {
        setProducts((prev) =>
          prev.map((item) => {
            if (item.id !== productId) return item

            if (field === 'pickupPrice' || field === 'dropoffPrice') {
              return {
                ...item,
                [field]: Number(value) || 0,
              }
            }

            return {
              ...item,
              [field]: value,
            }
          }),
        )
      },
    }),
    [products, records, selectedCompany],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const context = useContext(AppStateContext)
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider')
  }

  return context
}
