// lib/brokerage/negotiations/negotiation.types.ts
// Negotiation Type Definitions — Negotiation is the BUSINESS OBJECT

export type NegotiationStatus = 
  | 'active' 
  | 'pending_acceptance' 
  | 'accepted' 
  | 'declined' 
  | 'expired';

export type NegotiationRoundType = 
  | 'initial_offer' 
  | 'counter_proposal' 
  | 'revision' 
  | 'acceptance';

export interface NegotiationRound {
  id: string;
  negotiation_id: string;
  round_number: number;
  type: NegotiationRoundType;
  proposed_rental: number;
  proposed_deposit?: number;
  proposed_term?: number;
  proposed_commencement?: string;
  special_conditions?: string;
  notes?: string;
  proposed_by: string; // tenant | landlord | broker
  proposed_by_id?: string;
  status: 'sent' | 'viewed' | 'responded' | 'accepted' | 'declined';
  created_at: string;
}

export interface Negotiation {
  id: string;
  entity_id?: string;
  offer_id: string;
  vacancy_id: string;
  status: NegotiationStatus;
  rounds: NegotiationRound[];
  current_round: number;
  accepted_round_id?: string;
  final_rental?: number;
  final_terms?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateNegotiationParams {
  offer_id: string;
  vacancy_id: string;
  initial_round: Omit<NegotiationRound, 'id' | 'negotiation_id' | 'round_number' | 'created_at'>;
}

export interface AddNegotiationRoundParams {
  negotiation_id: string;
  proposed_rental: number;
  proposed_deposit?: number;
  proposed_term?: number;
  proposed_commencement?: string;
  special_conditions?: string;
  notes?: string;
  proposed_by: string;
  proposed_by_id?: string;
}

export interface AcceptNegotiationParams {
  negotiation_id: string;
  round_id: string;
  final_rental?: number;
  final_terms?: string;
}
