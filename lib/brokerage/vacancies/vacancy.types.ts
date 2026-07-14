// lib/brokerage/vacancies/vacancy.types.ts
// Vacancy Type Definitions

export type VacancyStatus = 'active' | 'marketing' | 'under_offer' | 'leased' | 'on_hold' | 'cancelled';
export type MarketingStatus = 'not_started' | 'in_progress' | 'active' | 'paused' | 'completed';

export interface Vacancy {
  id: string;
  property_id: string;
  unit_id: string;
  lease_id?: string;
  vacancy_date: string;
  expected_release_date?: string;
  reason?: string;
  status: VacancyStatus;
  listing_url?: string;
  brochure_url?: string;
  marketing_status: MarketingStatus;
  enquiry_count: number;
  viewing_count: number;
  offer_count: number;
  days_vacant: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateVacancyParams {
  property_id: string;
  unit_id: string;
  lease_id?: string;
  vacancy_date: string;
  expected_release_date?: string;
  reason?: string;
  listing_url?: string;
  brochure_url?: string;
}

export interface UpdateVacancyParams {
  expected_release_date?: string;
  reason?: string;
  status?: VacancyStatus;
  listing_url?: string;
  brochure_url?: string;
  marketing_status?: MarketingStatus;
}

export interface VacancyAnalytics {
  id: string;
  property_name: string;
  unit_number: string;
  status: VacancyStatus;
  days_vacant: number;
  enquiry_count: number;
  viewing_count: number;
  offer_count: number;
  conversion_rate: number;
  days_to_lease?: number;
}
