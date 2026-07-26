export type LeaseStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Executed' | 'Active' | 'Expired' | 'Terminated' | 'Cancelled' | 'Archived';

export interface Lease {
  id: string;
  lease_id: string;
  tenant_id: string;
  tenant_name?: string;
  property_id: string;
  property_name?: string;
  unit_id?: string;
  unit_number?: string;
  monthly_rental: number;
  deposit_amount?: number;
  escalation_percent?: number;
  commencement_date?: string;
  expiry_date?: string;
  lease_start_date?: string;
  lease_end_date?: string;
  signed_date?: string;
  beneficial_occupation_date?: string;
  lease_status: LeaseStatus;
  lease_type?: string;
  lease_category?: string;
  billing_frequency?: string;
  notice_period_days?: number;
  parking_bays?: number;
  parking_rate?: number;
  gla_sqm?: number;
  rental_rate_per_sqm?: number;
  currency?: string;
  security_levy?: number;
  marketing_levy?: number;
  owner_entity_id?: string;
  managing_entity_id?: string;
  renewal_stage?: string;
  escalation_level?: number;
  days_to_expiry?: number;
  vacancy_risk?: string;
  active_execution_id?: string;
  current_execution_version?: number;
  created_at: string;
  updated_at: string;
}

export interface LeaseData {
  tenant_id: string;
  property_id: string;
  unit_id?: string;
  monthly_rental: number;
  deposit_amount?: number;
  escalation_percent?: number;
  commencement_date?: string;
  expiry_date?: string;
  lease_type?: string;
  parking_bays?: number;
  parking_rate?: number;
  gla_sqm?: number;
  notice_period_days?: number;
  billing_frequency?: string;
  owner_entity_id?: string;
  managing_entity_id?: string;
}

export interface ArchiveIssue {
  code: string;
  count: number;
  label: string;
}
