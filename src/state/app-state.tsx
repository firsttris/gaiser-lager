import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type FlowType = 'pickup' | 'dropoff'
export type RecordStatus = 'offen' | 'in_bearbeitung' | 'abgerechnet' | 'bezahlt' | 'storniert'
export type PriceCategory = 'private' | 'business'

export type Company = {
  id: string
  shortCode: string
  name: string
  pin: string
  priceCategory: PriceCategory
}

export type Product = {
  id: number
  name: string
  unit: string
  flow: FlowType
  pickupPrivatePrice: number
  pickupBusinessPrice: number
  dropoffPrivatePrice: number
  dropoffBusinessPrice: number
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
  status: RecordStatus
  createdAt: string
}

type LoginResult = { ok: true } | { ok: false; message: string }
type CreateCompanyResult = { ok: true } | { ok: false; message: string }

type CreateRecordInput = {
  type: FlowType
  product: Product
  amount: number
  note: string
}

type CreateCompanyInput = {
  shortCode: string
  name: string
  pin: string
  priceCategory: PriceCategory
}

type AppState = {
  companies: Company[]
  selectedCompany: Company | null
  isLoggedIn: boolean
  isAdminLoggedIn: boolean
  products: Product[]
  records: RecordItem[]
  login: (companyId: string, pin: string) => LoginResult
  logout: () => void
  adminLogin: (password: string) => LoginResult
  adminLogout: () => void
  createRecord: (input: CreateRecordInput) => void
  createCompany: (input: CreateCompanyInput) => CreateCompanyResult
  updateProduct: (productId: number, field: keyof Product, value: string) => void
  updateRecordStatus: (recordId: number, status: RecordStatus) => void
}

const companiesSeed: Company[] = [
  { id: 'kr', shortCode: 'KR', name: 'Krampfert Wohnbau GmbH', pin: '1234', priceCategory: 'business' },
  { id: 'be', shortCode: 'BE', name: 'Bergbau Erden AG', pin: '2468', priceCategory: 'business' },
  { id: 'no', shortCode: 'NO', name: 'Nordstein Bau', pin: '7777', priceCategory: 'business' },
  { id: 'wa', shortCode: 'WA', name: 'Walter Tiefbau KG', pin: '2222', priceCategory: 'business' },
]

const productsSeed: Product[] = [
  // Annahme → Material bringen (dropoff)
  { id: 1,  name: 'Unbewehrter Betonschutt, Pflastersteine, Stahlbeton', unit: 't',  flow: 'dropoff', pickupPrivatePrice: 0,    pickupBusinessPrice: 0,    dropoffPrivatePrice: 8,  dropoffBusinessPrice: 8 },
  { id: 3,  name: 'Stark bewehrter Betonschutt',              unit: 't',  flow: 'dropoff', pickupPrivatePrice: 0,    pickupBusinessPrice: 0,    dropoffPrivatePrice: 45, dropoffBusinessPrice: 45 },
  { id: 4,  name: 'Bituminöser Straßenaufbruch',              unit: 't',  flow: 'dropoff', pickupPrivatePrice: 0,    pickupBusinessPrice: 0,    dropoffPrivatePrice: 15, dropoffBusinessPrice: 15 },
  { id: 5,  name: 'Gemischter Bauschutt',                     unit: 't',  flow: 'dropoff', pickupPrivatePrice: 0,    pickupBusinessPrice: 0,    dropoffPrivatePrice: 25, dropoffBusinessPrice: 25 },
  { id: 6,  name: 'Aushub',                                   unit: 'm³', flow: 'dropoff', pickupPrivatePrice: 0,    pickupBusinessPrice: 0,    dropoffPrivatePrice: 45, dropoffBusinessPrice: 40 },
  { id: 7,  name: 'Aushub mit Bauschutt o.ä. vermischt',      unit: 'm³', flow: 'dropoff', pickupPrivatePrice: 0,    pickupBusinessPrice: 0,    dropoffPrivatePrice: 60, dropoffBusinessPrice: 60 },
  // Verkauf → Material holen (pickup)
  { id: 8,  name: 'Betonrecycling 0/45 FSS-STS',              unit: 't',  flow: 'pickup', pickupPrivatePrice: 10,   pickupBusinessPrice: 8,    dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 9,  name: 'Bauschuttrecycling 0/56',                  unit: 't',  flow: 'pickup', pickupPrivatePrice: 0,    pickupBusinessPrice: 0,    dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 10, name: 'Gesiebt Mutterboden',                      unit: 't',  flow: 'pickup', pickupPrivatePrice: 12.5, pickupBusinessPrice: 8.5,  dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 11, name: 'Rollkies 8/16',                            unit: 't',  flow: 'pickup', pickupPrivatePrice: 27,   pickupBusinessPrice: 24.2, dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 12, name: 'Mischkies 0/16',                           unit: 't',  flow: 'pickup', pickupPrivatePrice: 29,   pickupBusinessPrice: 25.3, dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 13, name: 'Sand 0/2',                                 unit: 't',  flow: 'pickup', pickupPrivatePrice: 28,   pickupBusinessPrice: 24.4, dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 14, name: 'Schwemmsand',                              unit: 't',  flow: 'pickup', pickupPrivatePrice: 18,   pickupBusinessPrice: 15.5, dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 15, name: 'Mineralgemisch 0/16',                      unit: 't',  flow: 'pickup', pickupPrivatePrice: 24,   pickupBusinessPrice: 16.7, dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 16, name: 'Mineralgemisch 0/32',                      unit: 't',  flow: 'pickup', pickupPrivatePrice: 22,   pickupBusinessPrice: 15.1, dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 17, name: 'Splitt 2/5',                               unit: 't',  flow: 'pickup', pickupPrivatePrice: 27,   pickupBusinessPrice: 20.4, dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
]

type LegacyCompany = Omit<Company, 'priceCategory'> & { priceCategory?: PriceCategory }
type LegacyProduct = Omit<
  Product,
  'pickupPrivatePrice' | 'pickupBusinessPrice' | 'dropoffPrivatePrice' | 'dropoffBusinessPrice'
> & {
  pickupPrice?: number
  dropoffPrice?: number
  pickupPrivatePrice?: number
  pickupBusinessPrice?: number
  dropoffPrivatePrice?: number
  dropoffBusinessPrice?: number
}

function normalizeCompanies(raw: LegacyCompany[]): Company[] {
  return raw.map((company) => ({
    ...company,
    priceCategory: company.priceCategory ?? 'business',
  }))
}

function normalizeProducts(raw: LegacyProduct[]): Product[] {
  const defaultsById = new Map(productsSeed.map((product) => [product.id, product]))

  const normalized = raw.map((product) => {
    const defaults = defaultsById.get(product.id)

    return {
      id: product.id,
      name: product.name,
      unit: product.unit,
      flow: product.flow,
      // Legacy datasets had only one price field. We keep business from legacy,
      // but initialize missing private prices from the official 2026 price list seed.
      pickupPrivatePrice: product.pickupPrivatePrice ?? defaults?.pickupPrivatePrice ?? product.pickupPrice ?? 0,
      pickupBusinessPrice: product.pickupBusinessPrice ?? product.pickupPrice ?? defaults?.pickupBusinessPrice ?? 0,
      dropoffPrivatePrice: product.dropoffPrivatePrice ?? defaults?.dropoffPrivatePrice ?? product.dropoffPrice ?? 0,
      dropoffBusinessPrice: product.dropoffBusinessPrice ?? product.dropoffPrice ?? defaults?.dropoffBusinessPrice ?? 0,
    }
  })

  const hasAnyTierDifference = normalized.some((product) => {
    if (product.flow === 'pickup') {
      return product.pickupPrivatePrice !== product.pickupBusinessPrice
    }

    return product.dropoffPrivatePrice !== product.dropoffBusinessPrice
  })

  if (!hasAnyTierDifference) {
    return normalized.map((product) => {
      const defaults = defaultsById.get(product.id)
      if (!defaults) return product

      return {
        ...product,
        pickupPrivatePrice: defaults.pickupPrivatePrice,
        dropoffPrivatePrice: defaults.dropoffPrivatePrice,
      }
    })
  }

  return normalized
}

function getUnitPrice(product: Product, type: FlowType, priceCategory: PriceCategory) {
  if (type === 'pickup') {
    return priceCategory === 'private' ? product.pickupPrivatePrice : product.pickupBusinessPrice
  }

  return priceCategory === 'private' ? product.dropoffPrivatePrice : product.dropoffBusinessPrice
}

const AppStateContext = createContext<AppState | null>(null)
const ADMIN_PASSWORD = 'admin'
const STORAGE_KEYS = {
  companies: 'gaiser.mock.companies.v1',
  products: 'gaiser.mock.products.v1',
  records: 'gaiser.mock.records.v1',
  selectedCompanyId: 'gaiser.mock.selectedCompanyId.v1',
  adminLoggedIn: 'gaiser.mock.adminLoggedIn.v1',
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore quota/serialization errors in mock mode.
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>(() =>
    normalizeCompanies(readStorage<LegacyCompany[]>(STORAGE_KEYS.companies, companiesSeed)),
  )
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false)
  const [products, setProducts] = useState<Product[]>(() =>
    normalizeProducts(readStorage<LegacyProduct[]>(STORAGE_KEYS.products, productsSeed)),
  )
  const [records, setRecords] = useState<RecordItem[]>(() => readStorage(STORAGE_KEYS.records, []))
  const [storageReady, setStorageReady] = useState(false)

  useEffect(() => {
    const storedCompanies = normalizeCompanies(
      readStorage<LegacyCompany[]>(STORAGE_KEYS.companies, companiesSeed),
    )
    const storedProducts = normalizeProducts(
      readStorage<LegacyProduct[]>(STORAGE_KEYS.products, productsSeed),
    )
    const storedRecords = readStorage(STORAGE_KEYS.records, [])
    const storedSelectedCompanyId = readStorage<string | null>(STORAGE_KEYS.selectedCompanyId, null)
    const storedAdminLoggedIn = readStorage<boolean>(STORAGE_KEYS.adminLoggedIn, false)

    setCompanies(storedCompanies)
    setProducts(storedProducts)
    setRecords(storedRecords)
    setSelectedCompany(storedCompanies.find((company) => company.id === storedSelectedCompanyId) ?? null)
    setIsAdminLoggedIn(storedAdminLoggedIn)
    setStorageReady(true)
  }, [])

  useEffect(() => {
    if (!storageReady) return
    writeStorage(STORAGE_KEYS.companies, companies)
  }, [companies, storageReady])

  useEffect(() => {
    if (!storageReady) return
    writeStorage(STORAGE_KEYS.products, products)
  }, [products, storageReady])

  useEffect(() => {
    if (!storageReady) return
    writeStorage(STORAGE_KEYS.records, records)
  }, [records, storageReady])

  useEffect(() => {
    if (!storageReady) return
    writeStorage(STORAGE_KEYS.selectedCompanyId, selectedCompany?.id ?? null)
  }, [selectedCompany, storageReady])

  useEffect(() => {
    if (!storageReady) return
    writeStorage(STORAGE_KEYS.adminLoggedIn, isAdminLoggedIn)
  }, [isAdminLoggedIn, storageReady])

  useEffect(() => {
    if (!selectedCompany) return

    const exists = companies.some((company) => company.id === selectedCompany.id)
    if (!exists) {
      setSelectedCompany(null)
    }
  }, [companies, selectedCompany])

  useEffect(() => {
    if (typeof window === 'undefined') return

    function onStorage(event: StorageEvent) {
      if (!event.key) return

      if (event.key === STORAGE_KEYS.companies) {
        setCompanies(normalizeCompanies(readStorage<LegacyCompany[]>(STORAGE_KEYS.companies, companiesSeed)))
      }

      if (event.key === STORAGE_KEYS.products) {
        setProducts(normalizeProducts(readStorage<LegacyProduct[]>(STORAGE_KEYS.products, productsSeed)))
      }

      if (event.key === STORAGE_KEYS.records) {
        setRecords(readStorage(STORAGE_KEYS.records, []))
      }

      if (event.key === STORAGE_KEYS.selectedCompanyId) {
        const selectedCompanyId = readStorage<string | null>(STORAGE_KEYS.selectedCompanyId, null)
        const nextCompanies = normalizeCompanies(
          readStorage<LegacyCompany[]>(STORAGE_KEYS.companies, companiesSeed),
        )
        setSelectedCompany(nextCompanies.find((company) => company.id === selectedCompanyId) ?? null)
      }

      if (event.key === STORAGE_KEYS.adminLoggedIn) {
        setIsAdminLoggedIn(readStorage<boolean>(STORAGE_KEYS.adminLoggedIn, false))
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<AppState>(
    () => ({
      companies,
      selectedCompany,
      isLoggedIn: selectedCompany !== null,
      isAdminLoggedIn,
      products,
      records,
      login: (companyId: string, pin: string) => {
        const company = companies.find((item) => item.id === companyId)
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
      adminLogin: (password: string) => {
        if (password.trim() !== ADMIN_PASSWORD) {
          return { ok: false, message: 'Admin-Passwort ist falsch.' }
        }

        setIsAdminLoggedIn(true)
        return { ok: true }
      },
      adminLogout: () => {
        setIsAdminLoggedIn(false)
      },
      createRecord: ({ type, product, amount, note }: CreateRecordInput) => {
        if (!selectedCompany) return

        const unitPrice = getUnitPrice(product, type, selectedCompany.priceCategory)
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
      createCompany: ({ shortCode, name, pin, priceCategory }: CreateCompanyInput) => {
        const cleanedShortCode = shortCode.trim().toUpperCase()
        const cleanedName = name.trim()
        const cleanedPin = pin.replace(/[^0-9]/g, '').slice(0, 4)

        if (!cleanedShortCode || !cleanedName) {
          return { ok: false, message: 'Bitte Firmenname und Kuerzel ausfuellen.' }
        }

        if (cleanedPin.length !== 4) {
          return { ok: false, message: 'Die PIN muss 4-stellig sein.' }
        }

        const hasShortCode = companies.some((company) => company.shortCode === cleanedShortCode)
        if (hasShortCode) {
          return { ok: false, message: 'Das Firmenkuerzel ist bereits vergeben.' }
        }

        const company: Company = {
          id: `${cleanedShortCode.toLowerCase()}-${Date.now()}`,
          shortCode: cleanedShortCode,
          name: cleanedName,
          pin: cleanedPin,
          priceCategory,
        }

        setCompanies((prev) => [...prev, company])
        return { ok: true }
      },
      updateProduct: (productId: number, field: keyof Product, value: string) => {
        setProducts((prev) =>
          prev.map((item) => {
            if (item.id !== productId) return item

            if (
              field === 'pickupPrivatePrice' ||
              field === 'pickupBusinessPrice' ||
              field === 'dropoffPrivatePrice' ||
              field === 'dropoffBusinessPrice'
            ) {
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
      updateRecordStatus: (recordId: number, status: RecordStatus) => {
        setRecords((prev) =>
          prev.map((record) => {
            if (record.id !== recordId) return record
            return { ...record, status }
          }),
        )
      },
    }),
    [companies, isAdminLoggedIn, products, records, selectedCompany],
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
