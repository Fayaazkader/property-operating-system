// lib/brokerage/mandates/mandate.types.ts
// Mandate Type Definitions

export type MandateStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'completed';

export interface Mandate {
  id: string;
  entity_id?: string;
  broker_id: string;
  vacancy_id: string;
  mandate_date: string;
  expiry_date?: string;
  commission_rate: number;
  commission_type: 'percentage' | 'fixed' | 'tiered';
  terms?: string;
  exclusive: boolean;
  status: MandateStatus;
  mandate_url?: string;
  signed_mandate_url?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateMandateParams {
  broker_id: string;
  vacancy_id: string;
  mandate_date: string;
  expiry_date?: string;
  commission_rate: number;
  commission_type?: 'percentage' | 'fixed' | 'tiered';
  terms?: string;
  exclusive?: boolean;
  mandate_url?: string;
}

export interface UpdateMandateParams {
  expiry_date?: string;
  commission_rate?: number;
  commission_type?: 'percentage' | 'fixed' | 'tiered';
  terms?: string;
  exclusive?: boolean;
  status?: MandateStatus;
  mandate_url?: string;
  signed_mandate_url?: string;
}
