export type LeaseTemplateStatus =
  | 'draft'
  | 'active'
  | 'archived';

export type LeaseTemplateReviewStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected';

export type LeaseTemplateCategory =
  | 'industrial'
  | 'retail'
  | 'office'
  | 'residential'
  | 'commercial'
  | 'informal'
  | 'other';

  export interface LeaseTemplateFieldEvidence {
  text: string;
  page?: number;
  startOffset?: number;
  endOffset?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface LeaseTemplateField {
  
  key: string;
  label: string;
  type:
    | 'text'
    | 'number'
    | 'currency'
    | 'date'
    | 'percentage'
    | 'email'
    | 'phone'
    | 'boolean';
  required: boolean;

  /*
   * Values extracted from an existing/completed lease.
   * These remain provisional until an authorised reviewer approves them.
   */
  value?: unknown;
  confidence?: number;
    /*
   * Evidence showing where the extracted value came from.
   * Positional data is optional because not every OCR provider
   * exposes document coordinates.
   */
  evidence?: LeaseTemplateFieldEvidence[];

  /*
   * Explicit human-review state.
   * Extraction never constitutes approval.
   */
  approved?: boolean;

  placeholder?: string;
  source?: 'system' | 'user' | 'ai';
}

export interface LeaseTemplate {
  id: string;
  entity_id: string;

  family_id?: string;

  template_name: string;
  category: LeaseTemplateCategory;

  version: number;
  status: LeaseTemplateStatus;
  review_status: LeaseTemplateReviewStatus;

  source_document_id?: string | null;
  source_document_url?: string | null;
  source_document_checksum?: string | null;
  source_file_name?: string | null;
  source_mime_type?: string | null;

  fields: LeaseTemplateField[];

  field_mapping?: unknown[];
  ai_suggestions?: unknown[];
  clause_suggestions?: unknown[];

  property_ids?: string[];

  applies_to_property_types: string[];

  ai_enabled: boolean;

  created_by?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;

  archived_by?: string | null;
  archived_at?: string | null;

  created_at: string;
  updated_at: string;
}
