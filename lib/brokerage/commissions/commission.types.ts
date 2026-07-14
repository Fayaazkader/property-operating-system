// lib/brokerage/commissions/commission.types.ts
// Commission Type Definitions

export type CommissionStatus = 
  | 'pending_calculation' 
  | 'pending_approval' 
  | 'approved' 
  | 'payment_requested' 
  | 'declined';

export interface Commission {
  id: string;
  entity_id?: string;
  broker_id: string;
  lease_id: string;
  mandate_id?: string;
  vacancy_id?: string;
  commission_type: 'percentage' | 'fixed' | 'tiered';
  commission_rate: number;
  commission_amount?: number;
  calculation_snapshot: {
    // Store the entire calculation context for auditability
    annual_rent: number;
    lease_term_months: number;
    base_amount: number;
    rate_applied: number;
    split_percentage?: number;
    rule_version: string;
    calculation_date: string;
    inputs: Record<string, any>;
    outputs: Record<string, any>;
    reason?: string;
  };
  total_commission: number;
  split_percentage: number;
  status: CommissionStatus;
  approved_at?: string;
  approved_by?: string;
  payment_request_id?: string;
  payment_requested_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateCommissionParams {
  broker_id: string;
  lease_id: string;
  mandate_id?: string;
  vacancy_id?: string;
  commission_type: 'percentage' | 'fixed' | 'tiered';
  commission_rate: number;
  annual_rent: number;
  lease_term_months: number;
  split_percentage?: number;
  notes?: string;
  rule_version?: string;
}

export interface UpdateCommissionParams {
  status?: CommissionStatus;
  notes?: string;
}
