// lib/brokerage/offers/offer.types.ts
// Offer Type Definitions — Offer is the INITIAL proposal only

export type OfferStatus = 'received' | 'under_review' | 'negotiating' | 'accepted' | 'declined' | 'withdrawn';

export interface Offer {
  id: string;
  entity_id?: string;
  vacancy_id: string;
  enquiry_id?: string;
  broker_id?: string;
  offer_date: string;
  proposed_rental: number;
  proposed_deposit?: number;
  proposed_term?: number;
  proposed_commencement?: string;
  special_conditions?: string;
  status: OfferStatus;
  final_rental?: number;
  final_terms?: string;
  converted_to_lease_id?: string;
  accepted_negotiation_id?: string; // Links to the winning negotiation
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateOfferParams {
  vacancy_id: string;
  enquiry_id?: string;
  broker_id?: string;
  offer_date: string;
  proposed_rental: number;
  proposed_deposit?: number;
  proposed_term?: number;
  proposed_commencement?: string;
  special_conditions?: string;
}

export interface UpdateOfferParams {
  proposed_rental?: number;
  proposed_deposit?: number;
  proposed_term?: number;
  proposed_commencement?: string;
  special_conditions?: string;
  status?: OfferStatus;
  final_rental?: number;
  final_terms?: string;
}
