// lib/signing/types.ts
// AssetFlow Signing Engine Types

export type SigningFieldType = 'signature' | 'initial' | 'date' | 'text' | 'checkbox' | 'stamp' | 'witness';

export type SigningRequestType = 'lease' | 'document';

export interface SigningField {
  id: string;
  type: SigningFieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value?: string;
  signerRole?: 'landlord' | 'tenant' | 'witness';
  signerName?: string;
  signerEmail?: string;
  isTemplate?: boolean;       // true if this is a template field (pre-placed)
  replicatePages?: number[];   // for initials: which pages to replicate to
  isReplica?: boolean;         // true if this is a replica of a template initial
  templateId?: string;         // links replicas to their template
}

export interface SigningRequest {
  id: string;
  entity_id: string;
  request_type: SigningRequestType;
  lease_id?: string;
  document_name: string;
  document_url: string;
  fields: SigningField[];
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'completed' | 'expired';
  created_by: string;
  created_at: string;
  completed_at?: string;
}

export interface LeaseSigningTemplate {
  landlord_signature: { page: number; x: number; y: number; width: number; height: number };
  tenant_signature: { page: number; x: number; y: number; width: number; height: number };
  witness_signature?: { page: number; x: number; y: number; width: number; height: number };
  landlord_initials: { x: number; y: number; width: number; height: number; pages: number[] };
  tenant_initials: { x: number; y: number; width: number; height: number; pages: number[] };
  date_fields: Array<{ page: number; x: number; y: number; width?: number; height?: number }>;
  witnesses_count?: number;
}
