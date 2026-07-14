// lib/property-operations/suppliers/supplier.types.ts
// Supplier Type Definitions

export type SupplierStatus = 'active' | 'inactive' | 'suspended';

export interface Supplier {
  id: string;
  entity_id?: string;
  name: string;
  registration_number?: string;
  vat_number?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  whatsapp_number?: string;
  address?: string;
  categories: string[];
  insurance_verified: boolean;
  insurance_expiry?: string;
  insurance_document_url?: string;
  fica_verified: boolean;
  fica_verified_at?: string;
  fica_document_url?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_type?: string;
  bank_branch_code?: string;
  bank_verified: boolean;
  rating: number;
  jobs_completed: number;
  average_response_time?: number;
  average_completion_time?: number;
  safety_incidents: number;
  quality_rating: number;
  payment_terms_days: number;
  sla_response_hours?: number;
  sla_completion_days?: number;
  status: SupplierStatus;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateSupplierParams {
  name: string;
  registration_number?: string;
  vat_number?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  whatsapp_number?: string;
  address?: string;
  categories?: string[];
  payment_terms_days?: number;
}

export interface UpdateSupplierParams {
  name?: string;
  registration_number?: string;
  vat_number?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  whatsapp_number?: string;
  address?: string;
  categories?: string[];
  insurance_verified?: boolean;
  insurance_expiry?: string;
  fica_verified?: boolean;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_type?: string;
  bank_branch_code?: string;
  bank_verified?: boolean;
  rating?: number;
  jobs_completed?: number;
  average_response_time?: number;
  average_completion_time?: number;
  safety_incidents?: number;
  quality_rating?: number;
  payment_terms_days?: number;
  sla_response_hours?: number;
  sla_completion_days?: number;
  status?: SupplierStatus;
}
