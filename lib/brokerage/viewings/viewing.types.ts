// lib/brokerage/viewings/viewing.types.ts
// Viewing Type Definitions

export type ViewingStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface Viewing {
  id: string;
  entity_id?: string;
  enquiry_id: string;
  vacancy_id: string;
  broker_id?: string;
  viewing_date: string;
  duration_minutes: number;
  status: ViewingStatus;
  attendee_names?: string[];
  attendee_count: number;
  outcome?: string;
  feedback?: string;
  follow_up_date?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateViewingParams {
  enquiry_id: string;
  vacancy_id: string;
  broker_id?: string;
  viewing_date: string;
  duration_minutes?: number;
  attendee_names?: string[];
  notes?: string;
}

export interface UpdateViewingParams {
  viewing_date?: string;
  duration_minutes?: number;
  status?: ViewingStatus;
  attendee_names?: string[];
  outcome?: string;
  feedback?: string;
  follow_up_date?: string;
}
