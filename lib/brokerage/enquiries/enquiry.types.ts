// lib/brokerage/enquiries/enquiry.types.ts
// Enquiry Type Definitions

export type EnquiryStatus = 'new' | 'contacted' | 'viewing_scheduled' | 'declined' | 'converted';

export interface Enquiry {
  id: string;
  entity_id?: string;
  vacancy_id: string;
  broker_id?: string;
  applicant_name: string;
  applicant_company?: string;
  contact_email?: string;
  contact_phone?: string;
  enquiry_date: string;
  status: EnquiryStatus;
  notes?: string;
  source?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateEnquiryParams {
  vacancy_id: string;
  broker_id?: string;
  applicant_name: string;
  applicant_company?: string;
  contact_email?: string;
  contact_phone?: string;
  source?: string;
  notes?: string;
}

export interface UpdateEnquiryParams {
  applicant_name?: string;
  applicant_company?: string;
  contact_email?: string;
  contact_phone?: string;
  status?: EnquiryStatus;
  notes?: string;
  source?: string;
}
