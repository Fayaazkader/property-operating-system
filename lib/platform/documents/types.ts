// lib/platform/documents/types.ts
// Document Intelligence Platform Types

export type DocumentType =
  | 'lease_application' | 'signed_lease' | 'invoice' | 'purchase_order'
  | 'bank_statement' | 'meter_reading' | 'inspection_report'
  | 'maintenance_photo' | 'quote' | 'id_document' | 'unknown';

export type DocumentStatus =
  | 'received' | 'virus_scanning' | 'stored' | 'classifying'
  | 'classified' | 'ocr_processing' | 'extracting'
  | 'validating' | 'review' | 'approved' | 'rejected' | 'archived';

export type DocumentSource = 'upload' | 'whatsapp' | 'email' | 'scan' | 'automation' | 'api';
export type StorageProvider = 'supabase' | 's3' | 'azure' | 'gcp';
export type OCRProvider = 'azure' | 'google' | 'aws' | 'openai' | 'none';
export type ClassifierType = 'rules' | 'ai' | 'manual';

export interface Document {
  id: string;
  entity_id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes?: number;
  storage_provider: StorageProvider;
  storage_bucket: string;
  storage_key: string;
  storage_version: string;
  checksum?: string;
  document_type: DocumentType;
  classification_confidence?: number;
  classified_by: ClassifierType;
  status: DocumentStatus;
  ocr_provider?: OCRProvider;
  ocr_text?: string;
  ocr_confidence?: number;
  extracted_fields: Record<string, any>;
  extraction_confidence?: number;
  requires_review: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  parent_document_id?: string;
  version_number: number;
  is_latest_version: boolean;
  source: DocumentSource;
  tags: string[];
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentRelationship {
  id: string;
  document_id: string;
  related_entity_type: string;
  related_entity_id: string;
  relationship_type: string;
  created_at: string;
}

export interface DocumentLifecycleEvent {
  id: string;
  document_id: string;
  entity_id: string;
  stage: string;
  from_status?: string;
  to_status?: string;
  actor_id?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ExtractionRule {
  id: string;
  entity_id: string;
  document_type: DocumentType;
  field_name: string;
  field_label: string;
  extraction_pattern?: string;
  required: boolean;
  validation_rule?: string;
  target_entity_type?: string;
  target_field?: string;
  priority: number;
  is_active: boolean;
}

export interface ClassificationRule {
  id: string;
  entity_id: string;
  pattern: string;
  pattern_type: string;
  document_type: DocumentType;
  confidence: number;
  priority: number;
  is_active: boolean;
}

export interface ExtractedFields {
  [key: string]: any;
  confidence: number;
  requiresHumanReview: boolean;
  missingFields: string[];
}

export interface DocumentResult {
  document: Document;
  documentType: DocumentType;
  extractedFields: ExtractedFields;
  workflowId?: string;
  message: string;
}

export interface ProcessDocumentParams {
  fileUrl?: string;
  fileName: string;
  mimeType: string;
  fileBuffer?: ArrayBuffer;
  entityId: string;
  source?: DocumentSource;
  metadata?: Record<string, any>;
  relatedEntities?: Array<{ type: string; id: string }>;
}

export interface DocumentVersion {
  document: Document;
  versions: Document[];
}

export interface OCRResult {
  text: string;
  confidence: number;
  provider: OCRProvider;
  processedAt: string;
}
