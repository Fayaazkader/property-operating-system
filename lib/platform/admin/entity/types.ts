export interface Entity {
  id: string;
  name: string;
  entity_name?: string;
  entity_code?: string;
  trading_name?: string;
  registration_number?: string;
  vat_number?: string;
  physical_address?: string;
  postal_address?: string;
  telephone?: string;
  email?: string;
  website?: string;
  country?: string;
  financial_year_start?: number;
  accounting_mode?: string;
  base_currency?: string;
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface EntityData {
  name: string;
  trading_name?: string;
  entity_code?: string;
  registration_number?: string;
  vat_number?: string;
  physical_address?: string;
  postal_address?: string;
  telephone?: string;
  email?: string;
  website?: string;
  country?: string;
  financial_year_start?: number;
  accounting_mode?: string;
  base_currency?: string;
  is_active?: boolean;
}

export interface EntityStats {
  properties: number;
  tenants: number;
  leases: number;
  users: number;
}

export interface ArchiveIssue {
  code: string;
  count: number;
  label: string;
}
