// lib/property-operations/compliance/compliance.types.ts
// Compliance Type Definitions

export type ComplianceStatus = 'active' | 'expiring' | 'expired' | 'renewed' | 'cancelled';

export interface ComplianceItem {
  id: string;
  entity_id?: string;
  property_id: string;
  asset_id?: string;
  name: string;
  type: string;
  reference_number?: string;
  issuing_authority?: string;
  issue_date?: string;
  expiry_date: string;
  reminder_days: number;
  document_url?: string;
  status: ComplianceStatus;
  task_id?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateComplianceParams {
  property_id: string;
  asset_id?: string;
  name: string;
  type: string;
  reference_number?: string;
  issuing_authority?: string;
  issue_date?: string;
  expiry_date: string;
  reminder_days?: number;
  document_url?: string;
}

export interface UpdateComplianceParams {
  name?: string;
  type?: string;
  reference_number?: string;
  issuing_authority?: string;
  issue_date?: string;
  expiry_date?: string;
  reminder_days?: number;
  document_url?: string;
  status?: ComplianceStatus;
  task_id?: string;
}
