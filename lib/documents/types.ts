// lib/documents/types.ts
// Document Engine — Complete enterprise document model

export type DocumentType = 'invoice' | 'statement' | 'credit_note' | 'debit_note' | 'receipt' | 'owner_statement' | 'remittance' | 'lease_schedule';

export interface DocumentMetadata {
  document_type: DocumentType;
  document_number: string;
  issue_date: string;
  due_date?: string;
  billing_period?: string;
  statement_period?: string;
  currency: string;
  version: number;
  status: 'draft' | 'preview' | 'issued' | 'cancelled' | 'superseded';
  generated_at: string;
  generated_by?: string;
  prepared_by?: string;
}

export interface CompanyInfo {
  name: string;
  registration_number?: string;
  vat_number?: string;
  physical_address?: string;
  postal_address?: string;
  telephone?: string;
  email?: string;
  website?: string;
}

export interface CustomerInfo {
  name: string;
  code?: string;
  account_number?: string;
  property_name?: string;
  building?: string;
  unit?: string;
  lease_ref?: string;
  entity?: string;
  portfolio?: string;
}

export interface BankingDetails {
  bank_name: string;
  branch_name?: string;
  branch_code?: string;
  account_number: string;
  account_type?: string;
  reference: string;
  swift?: string;
  iban?: string;
  qr_code?: string;
}

export interface BrandingConfig {
  logo_url?: string;
  primary_color?: string;
  accent_color?: string;
  font_family?: string;
  footer_text?: string;
  legal_disclaimer?: string;
  watermark_enabled: boolean;
  show_powered_by: boolean;
}

export interface ChargeLine {
  charge_code?: string;
  gl_code?: string;
  description: string;
  billing_period?: string;
  quantity?: number;
  rate?: number;
  amount: number;
  vat_code?: string;
  vat_rate: number;
  vat_amount: number;
  total: number;
}

export interface LedgerLine {
  date: string;
  reference: string;
  transaction_type?: string;
  document_number?: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface AgingBucket {
  label: string;
  amount: number;
}

export interface ProjectedCharge {
  description: string;
  amount: number;
  status: 'projected_fixed' | 'projected_variable' | 'pending';
  confidence: string;
}

export interface PaymentReceived {
  reference: string;
  method: string;
  date: string;
  amount: number;
}

export interface CreditNoteApplied {
  reference: string;
  reason: string;
  amount: number;
  applied_to: string;
}

export interface DocumentSection {
  type: string;
  title?: string;
  data: any;
  variant?: 'default' | 'credit' | 'receipt' | 'summary';
}

export interface AccountSummary {
  opening_balance: number;
  current_charges: number;
  payments_received: number;
  credit_notes: number;
  adjustments: number;
  interest: number;
  closing_balance: number;
  amount_due: number;
}

export interface DocumentModel {
  metadata: DocumentMetadata;
  company: CompanyInfo;
  customer: CustomerInfo;
  banking?: BankingDetails;
  branding: BrandingConfig;
  header_message?: string;
  footer_message?: string;
  sections: DocumentSection[];
  totals: {
    subtotal: number;
    vat_total: number;
    total: number;
    payments_received: number;
    credits_applied: number;
    balance_due: number;
    opening_balance?: number;
    closing_balance?: number;
  };
  account_summary?: AccountSummary;
  deposit_held?: number;
  payment_terms?: string;
  aging?: AgingBucket[];
  contacts?: {
    accounts_email?: string;
    accounts_phone?: string;
    property_manager?: string;
    leasing?: string;
    maintenance?: string;
  };
}
