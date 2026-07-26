export interface Tenant {
  id: string;
  code?: string;
  tenant_name: string;
  trading_name?: string;
  tenant_type: string;
  company_registration?: string;
  vat_number?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  whatsapp_number?: string;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  billing_email?: string;
  statement_email?: string;
  credit_limit?: number;
  payment_terms: string;
  industry?: string;
  risk_rating?: string;
  kyc_status: string;
  insurance_expiry?: string;
  notes?: string;
  entity_id: string;
  status: string;
  is_archived: boolean;
  created_at: string;
}

export interface TenantData {
  tenant_name: string;
  trading_name?: string;
  tenant_type?: string;
  company_registration?: string;
  vat_number?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  whatsapp_number?: string;
  billing_email?: string;
  statement_email?: string;
  credit_limit?: number;
  payment_terms?: string;
  industry?: string;
  risk_rating?: string;
  kyc_status?: string;
  insurance_expiry?: string;
  notes?: string;
  entity_id: string;
}

export interface TenantContact {
  id: string;
  tenant_id: string;
  full_name: string;
  position?: string;
  department?: string;
  email?: string;
  mobile?: string;
  is_primary: boolean;
  created_at: string;
}

export interface ArchiveIssue {
  code: string;
  count: number;
  label: string;
}

export interface TenantContact {
  id: string;
  tenant_id: string;
  full_name: string;
  position?: string;
  department?: string;
  email?: string;
  mobile?: string;
  preferred_channel: string;
  receives_statements: boolean;
  receives_invoices: boolean;
  receives_arrears: boolean;
  receives_maintenance: boolean;
  is_primary: boolean;
  created_at: string;
}
