// lib/brokerage/engine/vacancy.types.ts
// Vacancy Domain Types — No stored counters, events drive lifecycle

export type VacancyStatus = 'active' | 'marketing' | 'under_offer' | 'converted' | 'closed' | 'cancelled';
export type MarketingStatus = 'not_started' | 'in_progress' | 'active' | 'paused' | 'completed';

export interface Vacancy {
  id: string;
  property_id: string;
  unit_id: string;
  lease_id?: string;
  vacancy_date: string;
  expected_release_date?: string;
  reason?: 'lease_expired' | 'tenant_terminated' | 'eviction' | 'renovation' | 'new_build' | 'other';
  status: VacancyStatus;
  marketing_status: MarketingStatus;
  listing_url?: string;
  brochure_url?: string;
  current_broker_id?: string;
  current_mandate_id?: string;
  converted_to_lease_id?: string;
  closed_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface VacancyMetrics {
  days_vacant: number;
  enquiry_count: number;
  viewing_count: number;
  offer_count: number;
  conversion_rate: number;
}

export const VacancyEvents = {
  Created: 'vacancy.created',
  BrokerAssigned: 'vacancy.broker.assigned',
  MarketingStarted: 'vacancy.marketing.started',
  EnquiryReceived: 'vacancy.enquiry.received',
  ViewingScheduled: 'vacancy.viewing.scheduled',
  OfferReceived: 'vacancy.offer.received',
  Converted: 'vacancy.converted',
  Closed: 'vacancy.closed',
} as const;

export type VacancyEvent = typeof VacancyEvents[keyof typeof VacancyEvents];
