export type PriceCategory = 'private' | 'business'

export type CompanyRow = {
  id: string
  name: string
  customer_number: string
  street: string
  postal_code: string
  city: string
  price_category: PriceCategory
  pin_hash: string
  failed_pin_attempts: number
  pin_locked_until: string | null
  created_at: string
  updated_at: string
}

export type CompanyPublicRow = Pick<CompanyRow, 'id' | 'name'>

export type AdminUserRow = {
  user_id: string
  created_at: string
}

export type FlowType = 'pickup' | 'dropoff'
export type RecordType = FlowType | 'lkw'
export type RecordStatus = 'offen' | 'lieferschein' | 'rechnung' | 'bezahlt' | 'storniert'

export type ProductRow = {
  id: number
  name: string
  unit: string
  flow: FlowType
  pickup_private_price: number
  pickup_business_price: number
  dropoff_private_price: number
  dropoff_business_price: number
  image_path: string | null
  created_at: string
}

export type TruckRow = {
  id: number
  name: string
  private_price: number
  business_price: number
  created_at: string
}

export type ConstructionSiteRow = {
  id: string
  name: string
  created_at: string
}

export type RecordRow = {
  id: number
  company_id: string
  company_name: string
  construction_site_id: string | null
  construction_site_name: string
  type: RecordType
  product_name: string
  amount: number
  unit: string
  unit_price: number
  total: number
  status: RecordStatus
  created_at: string
  delivery_note_id: string | null
  invoice_id: string | null
  invoice_reverse_charge: boolean
  cancel_id: string | null
}

export type NumberingSettingsRow = {
  id: true
  invoice_template: string
  delivery_note_template: string
  next_invoice_number: number
  next_delivery_note_number: number
  number_padding: number
  next_customer_number: number
}

export type SignupSettingsRow = {
  id: true
  master_pin_hash: string
  failed_pin_attempts: number
  pin_locked_until: string | null
  inactivity_timeout_minutes: number
  updated_at: string
}

export type InvoiceGroupRow = {
  invoice_id: string
  company_id: string
  company_name: string
  created_at: string
  total: number
  item_count: number
  invoice_reverse_charge: boolean
  // Raw records.status, not a UI label — invoiced records are only ever
  // 'rechnung' | 'bezahlt' | 'storniert' (never 'offen'/'lieferschein').
  status: 'rechnung' | 'bezahlt' | 'storniert'
}

type NumberIncrementResult = { template: string; counter: number; padding: number }[]
type CustomerNumberIncrementResult = { counter: number }[]

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: CompanyRow
        Insert: Omit<CompanyRow, 'id' | 'created_at' | 'updated_at' | 'failed_pin_attempts' | 'pin_locked_until'> &
          Partial<Pick<CompanyRow, 'failed_pin_attempts' | 'pin_locked_until'>>
        Update: Partial<Omit<CompanyRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      admin_users: {
        Row: AdminUserRow
        Insert: AdminUserRow
        Update: Partial<AdminUserRow>
        Relationships: []
      }
      products: {
        Row: ProductRow
        Insert: Omit<ProductRow, 'id' | 'created_at' | 'image_path'> & Partial<Pick<ProductRow, 'id' | 'image_path'>>
        Update: Partial<Omit<ProductRow, 'id' | 'created_at'>>
        Relationships: []
      }
      trucks: {
        Row: TruckRow
        Insert: Omit<TruckRow, 'id' | 'created_at'> & Partial<Pick<TruckRow, 'id'>>
        Update: Partial<Omit<TruckRow, 'id' | 'created_at'>>
        Relationships: []
      }
      construction_sites: {
        Row: ConstructionSiteRow
        Insert: Omit<ConstructionSiteRow, 'id' | 'created_at'> & Partial<Pick<ConstructionSiteRow, 'id'>>
        Update: Partial<Omit<ConstructionSiteRow, 'id' | 'created_at'>>
        Relationships: []
      }
      records: {
        Row: RecordRow
        Insert: Omit<
          RecordRow,
          'id' | 'created_at' | 'construction_site_id' | 'delivery_note_id' | 'invoice_id' | 'invoice_reverse_charge' | 'cancel_id'
        > &
          Partial<
            Pick<
              RecordRow,
              'id' | 'construction_site_id' | 'delivery_note_id' | 'invoice_id' | 'invoice_reverse_charge' | 'cancel_id'
            >
          >
        Update: Partial<Omit<RecordRow, 'id' | 'created_at'>>
        Relationships: []
      }
      numbering_settings: {
        Row: NumberingSettingsRow
        Insert: NumberingSettingsRow
        Update: Partial<Omit<NumberingSettingsRow, 'id'>>
        Relationships: []
      }
      signup_settings: {
        Row: SignupSettingsRow
        Insert: SignupSettingsRow
        Update: Partial<Omit<SignupSettingsRow, 'id'>>
        Relationships: []
      }
    }
    Views: {
      companies_public: {
        Row: CompanyPublicRow
        Relationships: []
      }
      invoice_groups: {
        Row: InvoiceGroupRow
        Relationships: []
      }
    }
    Functions: {
      next_delivery_note_number: {
        Args: Record<string, never>
        Returns: NumberIncrementResult
      }
      next_invoice_number: {
        Args: Record<string, never>
        Returns: NumberIncrementResult
      }
      next_customer_number: {
        Args: Record<string, never>
        Returns: CustomerNumberIncrementResult
      }
    }
  }
}
