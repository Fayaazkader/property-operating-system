// lib/brokerage/companies/company.types.ts
// Broker Company Type Definitions

export type BrokerCompanyStatus = 'active' | 'inactive';

export interface BrokerCompany {
  id: string;
  entity_id?: string;
  name: string;
  registration_number?: string;
  vat_number?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  default_commission_rate: number;
  default_commission_type: 'percentage' | 'fixed' | 'tiered';
  status: BrokerCompanyStatus;
  fica_verified: boolean;
  fica_verified_at?: string;
  mandate_template_url?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateCompanyParams {
  name: string;
  registration_number?: string;
  vat_number?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  default_commission_rate?: number;
  default_commission_type?: 'percentage' | 'fixed' | 'tiered';
}

export interface UpdateCompanyParams {
  name?: string;
  registration_number?: string;
  vat_number?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  default_commission_rate?: number;
  default_commission_type?: 'percentage' | 'fixed' | 'tiered';
  status?: BrokerCompanyStatus;
}
