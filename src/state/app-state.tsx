import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminSessionStatusQueryOptions, adminSignIn, adminSignOut } from '../server/admin-auth'
import { customerSessionStatusQueryOptions, customerSignIn, customerSignOut, customerSignUp } from '../server/customer-auth'
import {
  adminCompaniesQueryOptions,
  adminCreateCompany,
  adminUpdateCompany,
  adminDeleteCompany,
  adminSetCompanyPin,
} from '../server/companies'
import {
  adminSetMasterPin,
  adminUpdateInactivityTimeout,
  signupSettingsQueryOptions,
  verifySignupMasterPin,
} from '../server/signup-settings'
import { adminDownloadBackup } from '../server/backup'
import { downloadSqlFile } from '../utils/history-utils'
import {
  productsQueryOptions,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminUploadProductImage,
  adminRemoveProductImage,
} from '../server/products'
import { trucksQueryOptions, adminCreateTruck, adminUpdateTruck, adminDeleteTruck } from '../server/trucks'
import {
  constructionSitesQueryOptions,
  adminCreateConstructionSite,
  adminUpdateConstructionSite,
  adminDeleteConstructionSite,
} from '../server/construction-sites'
import {
  numberingSettingsQueryOptions,
  updateNumberingSettings as apiUpdateNumberingSettings,
} from '../server/numbering'
import {
  createRecord as apiCreateRecord,
  createTruckRecord as apiCreateTruckRecord,
  createInvoice as apiCreateInvoice,
  cancelRecords as apiCancelRecords,
  markInvoicesPaid as apiMarkInvoicesPaid,
} from '../server/records'

export { formatGeneratedNumber } from '../utils/numbering-format'

export type FlowType = 'pickup' | 'dropoff'
export type RecordType = FlowType | 'lkw'
export type RecordStatus = 'offen' | 'lieferschein' | 'rechnung' | 'bezahlt' | 'storniert'
// Every domain entity below lives in Supabase — see src/server/*.ts. Nothing
// in this file touches localStorage; AppStateProvider is a thin TanStack
// Query wrapper, not a data store.
export type Company = {
  id: string
  name: string
  customerNumber: string
  street: string
  postalCode: string
  city: string
  /** Where invoices are sent; empty for customers who don't have one yet. */
  email: string
}

export type Product = {
  id: number
  name: string
  unit: string
  flow: FlowType
  /** Net price per unit. */
  price: number
  imageUrl: string | null
}

export type Truck = {
  id: number
  name: string
  /** Net price per hour. */
  price: number
}

export type ConstructionSite = {
  id: string
  name: string
}

export type RecordItem = {
  id: number
  companyId: string
  company: string
  constructionSiteId: string
  constructionSiteName: string
  type: RecordType
  productName: string
  amount: number
  unit: string
  unitPrice: number
  total: number
  status: RecordStatus
  // Formatted for display in German time ("1.10.2026, 08:15:00").
  createdAt: string
  // Raw ISO timestamps, for anything that computes with dates.
  createdAtIso: string
  deliveryNoteId?: string
  invoiceId?: string
  invoiceReverseCharge?: boolean
  invoicedAt?: string
  cancelId?: string
  cancelledAt?: string
}

type LoginResult = { ok: true } | { ok: false; message: string }
export type IssuedDocumentResult = { ok: true; documentId: string; documentDate: string } | { ok: false; message: string }
type ActionResult = { ok: true } | { ok: false; message: string }
type CreateCompanyResult = { ok: true } | { ok: false; message: string }

export type NumberingSettings = {
  invoiceTemplate: string
  deliveryNoteTemplate: string
  nextInvoiceNumber: number
  nextDeliveryNoteNumber: number
  numberPadding: number
  customerNumberTemplate: string
  nextCustomerNumber: number
  highestCustomerNumber: number | null
}

export type SignupSettings = {
  inactivityTimeoutMinutes: number
  adminInactivityTimeoutMinutes: number
}

const DEFAULT_NUMBERING_SETTINGS: NumberingSettings = {
  invoiceTemplate: 'RG-{JAHR}{MONAT}{TAG}-{NUMMER}',
  deliveryNoteTemplate: 'LS-{JAHR}{MONAT}{TAG}-{NUMMER}',
  nextInvoiceNumber: 1,
  nextDeliveryNoteNumber: 1,
  numberPadding: 4,
  customerNumberTemplate: '{NUMMER}',
  nextCustomerNumber: 10600,
  highestCustomerNumber: null,
}

const DEFAULT_SIGNUP_SETTINGS: SignupSettings = {
  inactivityTimeoutMinutes: 5,
  adminInactivityTimeoutMinutes: 10,
}

type UpdateNumberingSettingsInput = Partial<NumberingSettings>

type CreateRecordInput = {
  type: FlowType
  product: Product
  amount: number
  constructionSiteName: string
  company?: Company
}

type CreateTruckRecordInput = {
  truck: Truck
  hours: number
  constructionSiteName: string
  company?: Company
}

type CreateCompanyInput = {
  name: string
  customerNumber: string
  street: string
  postalCode: string
  city: string
  pin: string
  email: string
}

type CreateProductInput = {
  name: string
  unit: string
  flow: FlowType
  price: string
}

type UpdateCompanyInput = {
  id: string
  name: string
  customerNumber: string
  street: string
  postalCode: string
  city: string
  email: string
}

type UpdateProductInput = {
  id: number
  name: string
  unit: string
  flow: FlowType
  price: string
}

type DeleteCompanyInput = {
  id: string
}

type DeleteProductInput = {
  id: number
}

type UploadProductImageInput = {
  id: number
  fileBase64: string
  contentType: string
}

type UploadProductImageResult = { ok: true; imageUrl: string | null } | { ok: false; message: string }

type RemoveProductImageInput = {
  id: number
}

type CreateTruckInput = {
  name: string
  price: string
}

type UpdateTruckInput = {
  id: number
  name: string
  price: string
}

type DeleteTruckInput = {
  id: number
}

type CreateConstructionSiteInput = {
  name: string
}

type UpdateConstructionSiteInput = {
  id: string
  name: string
}

type DeleteConstructionSiteInput = {
  id: string
}

type SetCompanyPinInput = {
  companyId: string
  pin: string
}

type SignUpInput = {
  masterPin: string
  name: string
  street: string
  postalCode: string
  city: string
  email: string
  pin: string
  pinConfirmation: string
}

type SetMasterPinInput = {
  pin: string
}

type VerifyMasterPinInput = {
  masterPin: string
}

type UpdateInactivityTimeoutInput = {
  customerMinutes: number
  adminMinutes: number
}

type AppState = {
  hydrated: boolean
  companies: Company[]
  selectedCompany: Company | null
  isLoggedIn: boolean
  isAdminLoggedIn: boolean
  products: Product[]
  trucks: Truck[]
  constructionSites: ConstructionSite[]
  numberingSettings: NumberingSettings
  signupSettings: SignupSettings
  login: (companyId: string, pin: string) => Promise<LoginResult>
  isLoggingIn: boolean
  // Both wait for the sign-out and then always load the customer login page
  // (full reload: clears all cached data and picks up a new app version).
  logout: () => Promise<void>
  isLoggingOut: boolean
  signUp: (input: SignUpInput) => Promise<LoginResult>
  isSigningUp: boolean
  verifyMasterPin: (input: VerifyMasterPinInput) => Promise<LoginResult>
  isVerifyingMasterPin: boolean
  setMasterPin: (input: SetMasterPinInput) => Promise<CreateCompanyResult>
  isSettingMasterPin: boolean
  updateInactivityTimeout: (input: UpdateInactivityTimeoutInput) => Promise<CreateCompanyResult>
  isUpdatingInactivityTimeout: boolean
  adminLogin: (email: string, password: string) => Promise<LoginResult>
  isAdminLoggingIn: boolean
  adminLogout: () => Promise<void>
  createRecord: (input: CreateRecordInput) => Promise<RecordItem | null>
  isCreatingRecord: boolean
  createTruckRecord: (input: CreateTruckRecordInput) => Promise<RecordItem | null>
  isCreatingTruckRecord: boolean
  createCompany: (input: CreateCompanyInput) => Promise<CreateCompanyResult>
  isCreatingCompany: boolean
  updateCompany: (input: UpdateCompanyInput) => Promise<CreateCompanyResult>
  isUpdatingCompany: boolean
  deleteCompany: (input: DeleteCompanyInput) => Promise<CreateCompanyResult>
  isDeletingCompany: boolean
  setCompanyPin: (input: SetCompanyPinInput) => Promise<CreateCompanyResult>
  isSettingCompanyPin: boolean
  createProduct: (input: CreateProductInput) => Promise<CreateCompanyResult>
  isCreatingProduct: boolean
  updateProduct: (input: UpdateProductInput) => Promise<CreateCompanyResult>
  isUpdatingProduct: boolean
  deleteProduct: (input: DeleteProductInput) => Promise<CreateCompanyResult>
  isDeletingProduct: boolean
  uploadProductImage: (input: UploadProductImageInput) => Promise<UploadProductImageResult>
  isUploadingProductImage: boolean
  removeProductImage: (input: RemoveProductImageInput) => Promise<CreateCompanyResult>
  isRemovingProductImage: boolean
  createTruck: (input: CreateTruckInput) => Promise<CreateCompanyResult>
  isCreatingTruck: boolean
  updateTruck: (input: UpdateTruckInput) => Promise<CreateCompanyResult>
  isUpdatingTruck: boolean
  deleteTruck: (input: DeleteTruckInput) => Promise<CreateCompanyResult>
  isDeletingTruck: boolean
  createConstructionSite: (input: CreateConstructionSiteInput) => Promise<CreateCompanyResult>
  isCreatingConstructionSite: boolean
  updateConstructionSite: (input: UpdateConstructionSiteInput) => Promise<CreateCompanyResult>
  isUpdatingConstructionSite: boolean
  deleteConstructionSite: (input: DeleteConstructionSiteInput) => Promise<CreateCompanyResult>
  isDeletingConstructionSite: boolean
  // Each runs as one database transaction; resolve only once it's persisted.
  createInvoice: (recordIds: number[]) => Promise<IssuedDocumentResult>
  cancelRecords: (recordIds: number[]) => Promise<IssuedDocumentResult>
  markInvoicesPaid: (invoiceIds: string[]) => Promise<ActionResult>
  updateNumberingSettings: (input: UpdateNumberingSettingsInput) => Promise<CreateCompanyResult>
  isUpdatingNumberingSettings: boolean
  downloadDatabaseBackup: () => Promise<CreateCompanyResult>
  isDownloadingBackup: boolean
}

const AppStateContext = createContext<AppState | null>(null)

// Turns a thrown server-function error (network, expired session) into the
// same { ok: false } shape as a rejected action, so callers handle one path.
async function withActionError<T extends { ok: boolean }>(run: () => Promise<T>): Promise<T | { ok: false; message: string }> {
  try {
    return await run()
  } catch {
    return { ok: false, message: 'Die Aktion ist fehlgeschlagen. Bitte Verbindung prüfen und erneut versuchen.' }
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const adminSessionQuery = useQuery(adminSessionStatusQueryOptions())
  const customerSessionQuery = useQuery(customerSessionStatusQueryOptions())
  const isAdminLoggedIn = adminSessionQuery.data?.isAdminLoggedIn ?? false
  const selectedCompany = customerSessionQuery.data?.company ?? null
  const hasSession = isAdminLoggedIn || selectedCompany !== null

  // The full customer list is admin-only; the customer login searches
  // server-side instead (searchCompanies), so it can't be browsed.
  const companiesQuery = useQuery({ ...adminCompaniesQueryOptions(), enabled: isAdminLoggedIn })
  const companies = companiesQuery.data ?? []

  // Dual-mode catalog/records data — only meaningful once some session exists,
  // so these stay disabled (and don't block hydration) before any login.
  const productsQuery = useQuery({ ...productsQueryOptions(), enabled: hasSession })
  const trucksQuery = useQuery({ ...trucksQueryOptions(), enabled: hasSession })
  const constructionSitesQuery = useQuery({ ...constructionSitesQueryOptions(), enabled: hasSession })
  const numberingSettingsQuery = useQuery({ ...numberingSettingsQueryOptions(), enabled: isAdminLoggedIn })
  const signupSettingsQuery = useQuery({ ...signupSettingsQueryOptions(), enabled: hasSession })

  const products = productsQuery.data ?? []
  const trucks = trucksQuery.data ?? []
  const constructionSites = constructionSitesQuery.data ?? []
  const numberingSettings = numberingSettingsQuery.data ?? DEFAULT_NUMBERING_SETTINGS
  const signupSettings = signupSettingsQuery.data ?? DEFAULT_SIGNUP_SETTINGS

  const hydrated =
    adminSessionQuery.isFetched &&
    customerSessionQuery.isFetched &&
    (!isAdminLoggedIn || companiesQuery.isFetched) &&
    (!hasSession || (productsQuery.isFetched && trucksQuery.isFetched && constructionSitesQuery.isFetched))

  const invalidate = (queryKey: readonly unknown[]) => void queryClient.invalidateQueries({ queryKey })

  const adminSignInMutation = useMutation({
    mutationFn: adminSignIn,
    onSuccess: (result) => {
      if (result.ok) invalidate(['auth', 'admin'])
    },
  })
  const adminSignOutMutation = useMutation({
    mutationFn: adminSignOut,
    onSuccess: () => {
      invalidate(['auth', 'admin'])
      invalidate(['companies'])
    },
  })
  const customerSignInMutation = useMutation({
    mutationFn: customerSignIn,
    onSuccess: (result) => {
      if (result.ok) invalidate(['auth', 'customer'])
    },
  })
  const customerSignOutMutation = useMutation({
    mutationFn: customerSignOut,
    onSuccess: () => invalidate(['auth', 'customer']),
  })
  const customerSignUpMutation = useMutation({
    mutationFn: customerSignUp,
    onSuccess: (result) => {
      if (result.ok) invalidate(['auth', 'customer'])
    },
  })
  const setMasterPinMutation = useMutation({ mutationFn: adminSetMasterPin })
  const updateInactivityTimeoutMutation = useMutation({
    mutationFn: adminUpdateInactivityTimeout,
    onSuccess: (result) => {
      if (result.ok) invalidate(['signup-settings'])
    },
  })
  const verifyMasterPinMutation = useMutation({ mutationFn: verifySignupMasterPin })
  const createCompanyMutation = useMutation({
    mutationFn: adminCreateCompany,
    onSuccess: (result) => {
      if (result.ok) invalidate(['companies'])
    },
  })
  const updateCompanyMutation = useMutation({
    mutationFn: adminUpdateCompany,
    onSuccess: (result) => {
      if (result.ok) invalidate(['companies'])
    },
  })
  const deleteCompanyMutation = useMutation({
    mutationFn: adminDeleteCompany,
    onSuccess: (result) => {
      if (result.ok) invalidate(['companies'])
    },
  })
  const setCompanyPinMutation = useMutation({ mutationFn: adminSetCompanyPin })

  const createProductMutation = useMutation({
    mutationFn: adminCreateProduct,
    onSuccess: (result) => {
      if (result.ok) invalidate(['products'])
    },
  })
  const updateProductMutation = useMutation({
    mutationFn: adminUpdateProduct,
    onSuccess: (result) => {
      if (result.ok) {
        invalidate(['products'])
        invalidate(['records'])
      }
    },
  })
  const deleteProductMutation = useMutation({
    mutationFn: adminDeleteProduct,
    onSuccess: (result) => {
      if (result.ok) invalidate(['products'])
    },
  })
  const uploadProductImageMutation = useMutation({
    mutationFn: adminUploadProductImage,
    onSuccess: (result) => {
      if (result.ok) invalidate(['products'])
    },
  })
  const removeProductImageMutation = useMutation({
    mutationFn: adminRemoveProductImage,
    onSuccess: (result) => {
      if (result.ok) invalidate(['products'])
    },
  })

  const createTruckMutation = useMutation({
    mutationFn: adminCreateTruck,
    onSuccess: (result) => {
      if (result.ok) invalidate(['trucks'])
    },
  })
  const updateTruckMutation = useMutation({
    mutationFn: adminUpdateTruck,
    onSuccess: (result) => {
      if (result.ok) {
        invalidate(['trucks'])
        invalidate(['records'])
      }
    },
  })
  const deleteTruckMutation = useMutation({
    mutationFn: adminDeleteTruck,
    onSuccess: (result) => {
      if (result.ok) invalidate(['trucks'])
    },
  })

  const createSiteMutation = useMutation({
    mutationFn: adminCreateConstructionSite,
    onSuccess: (result) => {
      if (result.ok) invalidate(['construction-sites'])
    },
  })
  const updateSiteMutation = useMutation({
    mutationFn: adminUpdateConstructionSite,
    onSuccess: (result) => {
      if (result.ok) {
        invalidate(['construction-sites'])
        invalidate(['records'])
      }
    },
  })
  const deleteSiteMutation = useMutation({
    mutationFn: adminDeleteConstructionSite,
    onSuccess: (result) => {
      if (result.ok) invalidate(['construction-sites'])
    },
  })

  // A new Vorgang may have created a new construction site on the way.
  const createRecordMutation = useMutation({
    mutationFn: apiCreateRecord,
    onSuccess: (record) => {
      if (record) {
        invalidate(['records'])
        invalidate(['construction-sites'])
      }
    },
  })
  const createTruckRecordMutation = useMutation({
    mutationFn: apiCreateTruckRecord,
    onSuccess: (record) => {
      if (record) {
        invalidate(['records'])
        invalidate(['construction-sites'])
      }
    },
  })
  // Document actions change records shown both in Vorgänge (['records']) and
  // Rechnungen (['invoice-groups']), so both lists are refreshed.
  const invalidateDocuments = () => {
    invalidate(['records'])
    invalidate(['invoice-groups'])
  }
  const createInvoiceMutation = useMutation({
    mutationFn: apiCreateInvoice,
    onSettled: invalidateDocuments,
  })
  const cancelRecordsMutation = useMutation({
    mutationFn: apiCancelRecords,
    onSettled: invalidateDocuments,
  })
  const markInvoicesPaidMutation = useMutation({
    mutationFn: apiMarkInvoicesPaid,
    onSettled: invalidateDocuments,
  })

  const updateNumberingSettingsMutation = useMutation({
    mutationFn: apiUpdateNumberingSettings,
    onSuccess: (result) => {
      if (result.ok) invalidate(['numbering-settings'])
    },
  })

  const downloadBackupMutation = useMutation({
    mutationFn: adminDownloadBackup,
    onSuccess: (result) => {
      if (result.ok) downloadSqlFile(result.filename, result.content)
    },
  })

  const value = useMemo<AppState>(
    () => ({
      hydrated,
      companies,
      selectedCompany,
      isLoggedIn: selectedCompany !== null,
      isAdminLoggedIn,
      products,
      trucks,
      constructionSites,
      numberingSettings,
      signupSettings,
      login: async (companyId, pin) => customerSignInMutation.mutateAsync({ data: { companyId, pin } }),
      isLoggingIn: customerSignInMutation.isPending,
      logout: async () => {
        try {
          await customerSignOutMutation.mutateAsync({})
        } finally {
          window.location.assign('/')
        }
      },
      isLoggingOut: customerSignOutMutation.isPending || adminSignOutMutation.isPending,
      signUp: async (input) => customerSignUpMutation.mutateAsync({ data: input }),
      isSigningUp: customerSignUpMutation.isPending,
      verifyMasterPin: async (input) => verifyMasterPinMutation.mutateAsync({ data: input }),
      isVerifyingMasterPin: verifyMasterPinMutation.isPending,
      setMasterPin: async (input) => setMasterPinMutation.mutateAsync({ data: input }),
      isSettingMasterPin: setMasterPinMutation.isPending,
      updateInactivityTimeout: async (input) => updateInactivityTimeoutMutation.mutateAsync({ data: input }),
      isUpdatingInactivityTimeout: updateInactivityTimeoutMutation.isPending,
      adminLogin: async (email, password) => adminSignInMutation.mutateAsync({ data: { email, password } }),
      isAdminLoggingIn: adminSignInMutation.isPending,
      adminLogout: async () => {
        try {
          await adminSignOutMutation.mutateAsync({})
        } finally {
          window.location.assign('/')
        }
      },
      createRecord: async ({ type, product, amount, constructionSiteName, company }: CreateRecordInput) => {
        return createRecordMutation.mutateAsync({
          data: { type, productId: product.id, amount, constructionSiteName, companyId: company?.id },
        })
      },
      isCreatingRecord: createRecordMutation.isPending,
      createTruckRecord: async ({ truck, hours, constructionSiteName, company }: CreateTruckRecordInput) => {
        return createTruckRecordMutation.mutateAsync({
          data: { truckId: truck.id, hours, constructionSiteName, companyId: company?.id },
        })
      },
      isCreatingTruckRecord: createTruckRecordMutation.isPending,
      createCompany: async (input) => createCompanyMutation.mutateAsync({ data: input }),
      isCreatingCompany: createCompanyMutation.isPending,
      updateCompany: async (input) => updateCompanyMutation.mutateAsync({ data: input }),
      isUpdatingCompany: updateCompanyMutation.isPending,
      deleteCompany: async (input) => deleteCompanyMutation.mutateAsync({ data: input }),
      isDeletingCompany: deleteCompanyMutation.isPending,
      setCompanyPin: async (input) => setCompanyPinMutation.mutateAsync({ data: input }),
      isSettingCompanyPin: setCompanyPinMutation.isPending,
      createProduct: async (input) => createProductMutation.mutateAsync({ data: input }),
      isCreatingProduct: createProductMutation.isPending,
      updateProduct: async (input) => updateProductMutation.mutateAsync({ data: input }),
      isUpdatingProduct: updateProductMutation.isPending,
      deleteProduct: async (input) => deleteProductMutation.mutateAsync({ data: input }),
      isDeletingProduct: deleteProductMutation.isPending,
      uploadProductImage: async (input) => uploadProductImageMutation.mutateAsync({ data: input }),
      isUploadingProductImage: uploadProductImageMutation.isPending,
      removeProductImage: async (input) => removeProductImageMutation.mutateAsync({ data: input }),
      isRemovingProductImage: removeProductImageMutation.isPending,
      createTruck: async (input) => createTruckMutation.mutateAsync({ data: input }),
      isCreatingTruck: createTruckMutation.isPending,
      updateTruck: async (input) => updateTruckMutation.mutateAsync({ data: input }),
      isUpdatingTruck: updateTruckMutation.isPending,
      deleteTruck: async (input) => deleteTruckMutation.mutateAsync({ data: input }),
      isDeletingTruck: deleteTruckMutation.isPending,
      createConstructionSite: async (input) => createSiteMutation.mutateAsync({ data: input }),
      isCreatingConstructionSite: createSiteMutation.isPending,
      updateConstructionSite: async (input) => updateSiteMutation.mutateAsync({ data: input }),
      isUpdatingConstructionSite: updateSiteMutation.isPending,
      deleteConstructionSite: async (input) => deleteSiteMutation.mutateAsync({ data: input }),
      isDeletingConstructionSite: deleteSiteMutation.isPending,
      createInvoice: async (recordIds) => {
        const result = await withActionError(() => createInvoiceMutation.mutateAsync({ data: { recordIds } }))
        if (result.ok) invalidate(['numbering-settings'])
        return result
      },
      cancelRecords: async (recordIds) => withActionError(() => cancelRecordsMutation.mutateAsync({ data: { recordIds } })),
      markInvoicesPaid: async (invoiceIds) => withActionError(() => markInvoicesPaidMutation.mutateAsync({ data: { invoiceIds } })),
      updateNumberingSettings: async (input) => updateNumberingSettingsMutation.mutateAsync({ data: input }),
      isUpdatingNumberingSettings: updateNumberingSettingsMutation.isPending,
      downloadDatabaseBackup: async () => {
        try {
          const result = await downloadBackupMutation.mutateAsync({})
          return result.ok ? { ok: true } : { ok: false, message: 'Backup konnte nicht erstellt werden.' }
        } catch {
          return { ok: false, message: 'Backup konnte nicht erstellt werden.' }
        }
      },
      isDownloadingBackup: downloadBackupMutation.isPending,
    }),
    [
      hydrated,
      companies,
      selectedCompany,
      isAdminLoggedIn,
      products,
      trucks,
      constructionSites,
      numberingSettings,
      signupSettings,
      customerSignInMutation,
      customerSignOutMutation,
      customerSignUpMutation,
      verifyMasterPinMutation,
      setMasterPinMutation,
      updateInactivityTimeoutMutation,
      adminSignInMutation,
      adminSignOutMutation,
      createRecordMutation,
      createTruckRecordMutation,
      createCompanyMutation,
      updateCompanyMutation,
      deleteCompanyMutation,
      setCompanyPinMutation,
      createProductMutation,
      updateProductMutation,
      deleteProductMutation,
      uploadProductImageMutation,
      removeProductImageMutation,
      createTruckMutation,
      updateTruckMutation,
      deleteTruckMutation,
      createSiteMutation,
      updateSiteMutation,
      deleteSiteMutation,
      createInvoiceMutation,
      cancelRecordsMutation,
      markInvoicesPaidMutation,
      updateNumberingSettingsMutation,
      downloadBackupMutation,
    ],
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
