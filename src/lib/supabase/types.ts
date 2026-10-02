export type CompanyRow = {
  id: string
  name: string
  customer_number: string
  street: string
  postal_code: string
  city: string
  email: string | null
  pin_hash: string
  failed_pin_attempts: number
  pin_locked_until: string | null
  pin_changed_at: string | null
  created_at: string
  updated_at: string
}

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
  // Net price per unit. (The former private/business price columns are
  // removed by a follow-up migration and no longer used.)
  price: number
  image_path: string | null
  created_at: string
}

export type TruckRow = {
  id: number
  name: string
  price: number
  created_at: string
}

export type ConstructionSiteRow = {
  id: string
  name: string
  company_id: string
  created_at: string
}

export type EmployeeRow = {
  id: string
  name: string
  pin_hash: string
  active: boolean
  failed_pin_attempts: number
  pin_locked_until: string | null
  pin_changed_at: string | null
  created_at: string
  updated_at: string
}

export type DeliveryNotePhotoRow = {
  id: string
  batch_id: string
  /** The LKW Vorgang the photo belongs to (NULL for photos from before 2026-10). */
  record_id: number | null
  storage_path: string
  employee_id: string | null
  employee_name: string | null
  company_id: string | null
  company_name: string | null
  note: string
  created_at: string
  processed_at: string | null
}

export type EmailSettingsRow = {
  id: boolean
  smtp_host: string
  smtp_port: number
  smtp_security: 'starttls' | 'tls'
  smtp_user: string
  smtp_password_encrypted: string | null
  from_name: string
  from_address: string
  reply_to: string
  bcc: string
  invoice_subject_template: string
  invoice_body_template: string
  cancellation_subject_template: string
  cancellation_body_template: string
  updated_at: string
}

export type InvoiceEmailRow = {
  id: number
  invoice_id: string
  document_kind: 'invoice' | 'cancellation'
  company_id: string | null
  recipient: string
  bcc: string
  subject: string
  e_invoice: boolean
  status: 'sent' | 'failed'
  error: string | null
  message_id: string | null
  sent_at: string
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
  invoiced_at: string | null
  cancelled_at: string | null
  created_by_employee_id: string | null
  created_by_name: string | null
}

export type NumberingSettingsRow = {
  id: true
  invoice_template: string
  delivery_note_template: string
  next_invoice_number: number
  next_delivery_note_number: number
  number_padding: number
  next_customer_number: number
  customer_number_template: string
}

export type SignupSettingsRow = {
  id: true
  master_pin_hash: string
  failed_pin_attempts: number
  pin_locked_until: string | null
  inactivity_timeout_minutes: number
  admin_inactivity_timeout_minutes: number
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
type IssuedDocumentResult = { document_id: string; document_date: string }[]

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: CompanyRow
        Insert: Omit<CompanyRow, 'id' | 'created_at' | 'updated_at' | 'failed_pin_attempts' | 'pin_locked_until' | 'pin_changed_at' | 'email'> &
          Partial<Pick<CompanyRow, 'failed_pin_attempts' | 'pin_locked_until' | 'pin_changed_at' | 'email'>>
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
      employees: {
        Row: EmployeeRow
        Insert: Pick<EmployeeRow, 'name' | 'pin_hash'> & Partial<Pick<EmployeeRow, 'active' | 'pin_changed_at'>>
        Update: Partial<Omit<EmployeeRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      delivery_note_photos: {
        Row: DeliveryNotePhotoRow
        Insert: Omit<DeliveryNotePhotoRow, 'id' | 'created_at' | 'processed_at' | 'note' | 'record_id'> &
          Partial<Pick<DeliveryNotePhotoRow, 'note' | 'processed_at' | 'record_id'>>
        Update: Partial<Omit<DeliveryNotePhotoRow, 'id' | 'created_at'>>
        Relationships: []
      }
      email_settings: {
        Row: EmailSettingsRow
        Insert: Partial<EmailSettingsRow>
        Update: Partial<Omit<EmailSettingsRow, 'id'>>
        Relationships: []
      }
      invoice_emails: {
        Row: InvoiceEmailRow
        Insert: Omit<InvoiceEmailRow, 'id' | 'sent_at' | 'bcc' | 'error' | 'message_id' | 'company_id' | 'document_kind'> &
          Partial<Pick<InvoiceEmailRow, 'bcc' | 'error' | 'message_id' | 'company_id' | 'document_kind'>>
        Update: never
        Relationships: []
      }
      password_reset_requests: {
        Row: { id: number; email: string; requested_at: string }
        Insert: { email: string }
        Update: never
        Relationships: []
      }
      records: {
        Row: RecordRow
        Insert: Omit<
          RecordRow,
          | 'id'
          | 'created_at'
          | 'construction_site_id'
          | 'delivery_note_id'
          | 'invoice_id'
          | 'invoice_reverse_charge'
          | 'cancel_id'
          | 'invoiced_at'
          | 'cancelled_at'
          | 'created_by_employee_id'
          | 'created_by_name'
        > &
          Partial<
            Pick<
              RecordRow,
              | 'id'
              | 'construction_site_id'
              | 'delivery_note_id'
              | 'invoice_id'
              | 'invoice_reverse_charge'
              | 'cancel_id'
              | 'created_by_employee_id'
              | 'created_by_name'
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
      create_invoice: {
        Args: { p_record_ids: number[] }
        Returns: IssuedDocumentResult
      }
      next_free_customer_number: {
        Args: Record<string, never>
        Returns: string
      }
      highest_customer_number: {
        Args: Record<string, never>
        Returns: number | null
      }
      keepalive: {
        Args: Record<string, never>
        Returns: number
      }
      claim_employee_pin_attempt: {
        Args: { p_employee_id: string; p_max_attempts: number; p_lock_minutes: number }
        Returns: boolean
      }
      cancel_records: {
        Args: { p_record_ids: number[] }
        Returns: IssuedDocumentResult
      }
      mark_invoices_paid: {
        Args: { p_invoice_ids: string[] }
        Returns: number
      }
      claim_company_pin_attempt: {
        Args: { p_company_id: string; p_max_attempts: number; p_lock_minutes: number }
        Returns: boolean
      }
      claim_master_pin_attempt: {
        Args: { p_max_attempts: number; p_lock_minutes: number }
        Returns: boolean
      }
    }
  }
}
