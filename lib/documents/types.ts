// lib/documents/types.ts
// Document Engine — Renderer-agnostic document model

export type DocumentType = 'invoice' | 'statement' | 'credit_note' | 'debit_note' | 'receipt' | 'owner_statement' | 'remittance' | 'lease_schedule';

export interface DocumentMetadata {
  document_type: DocumentType;
  document_number: string;
  issue_date: string;
  due_date?: string;
  period_start?: string;
  period_end?: string;
  version: number;
  status: 'draft' | 'preview' | 'issued' | 'cancelled' | 'superseded';
  generated_at: string;
  generated_by?: string;
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
}

export interface BankingDetails {
  bank_name: string;
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
  gl_code?: string;
  charge_code?: string;
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
  deposit_held?: number;
  payment_terms?: string;
  contacts?: {
    accounts?: string;
    property_manager?: string;
    leasing?: string;
    maintenance?: string;
  };
}
