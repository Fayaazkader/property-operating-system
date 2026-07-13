// lib/execution/types.ts
// Execution Engine Type Definitions

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Enums (mirroring database)
// ============================================================

export type ExecutionStatus = 
  | 'draft'
  | 'under_review'
  | 'ready'
  | 'sent'
  | 'viewed'
  | 'declined'
  | 'partially_signed'
  | 'executed'
  | 'effective'
  | 'activated'
  | 'cancelled'
  | 'expired';

export type ParticipantStatus = 
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'declined'
  | 'signed'
  | 'completed';

export type ExecutionEventType = 
  | 'draft_generated'
  | 'review_started'
  | 'review_completed'
  | 'ready'
  | 'sent'
  | 'viewed'
  | 'declined'
  | 'reminder_sent'
  | 'reminder_opened'
  | 'signed'
  | 'executed'
  | 'effective'
  | 'activated'
  | 'cancelled'
  | 'expired'
  | 'escalated'
  | 'returned_for_changes'
  | 'locked'
  | 'unlocked';

export type ExecutionProvider = 
  | 'native'
  | 'docusign'
  | 'adobe'
  | 'uploaded';

export type SigningMethod = 
  | 'standard'
  | 'verified_otp'
  | 'qualified_digital'
  | 'external_provider'
  | 'uploaded_copy';

export type SigningOrder = 
  | 'sequential'
  | 'parallel';

export type ParticipantType = 
  | 'tenant'
  | 'landlord'
  | 'witness'
  | 'surety'
  | 'director'
  | 'attorney'
  | 'property_manager'
  | 'supplier'
  | 'approver';

export type SourceType = 
  | 'lease'
  | 'lease_renewal'
  | 'lease_addendum'
  | 'supplier_contract'
  | 'management_agreement'
  | 'service_contract'
  | 'mandate';

// ============================================================
// Core Interfaces
// ============================================================

export interface Execution {
  id: string;
  source_type: SourceType;
  source_id: string;
  version: number;
  snapshot: any;
  status: ExecutionStatus;
  provider: ExecutionProvider;
  signing_method: SigningMethod;
  signing_order: SigningOrder;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  ready_score: number;
  validation_checks: any[];
  sla_days: number;
  sent_at: string | null;
  reminder_sent_at: string | null;
  escalated_at: string | null;
  expired_at: string | null;
  executed_at: string | null;
  effective_date: string | null;
  activated_at: string | null;
  document_package_url: string | null;
  execution_certificate_url: string | null;
  sha_hash: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  deleted_at: string | null;
}

export interface ExecutionParticipant {
  id: string;
  execution_id: string;
  participant_type: ParticipantType;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  signing_order: number;
  status: ParticipantStatus;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: any;
  location: string | null;
  otp_code: string | null;
  otp_sent_at: string | null;
  otp_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExecutionEvent {
  id: string;
  execution_id: string;
  event_type: ExecutionEventType;
  event_data: any;
  ip_address: string | null;
  user_agent: string | null;
  device_info: any;
  location: string | null;
  created_at: string;
  created_by: string | null;
}

export interface ExecutionPolicy {
  id: string;
  entity_id: string | null;
  portfolio_id: string | null;
  policy_name: string;
  requires_review: boolean;
  requires_otp: boolean;
  signing_order: SigningOrder;
  reminder_frequency_days: number;
  expiry_days: number;
  required_documents: string[];
  required_participants: string[];
  default_signing_method: SigningMethod;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Request/Response Types
// ============================================================

export interface CreateExecutionParams {
  source_type: SourceType;
  source_id: string;
  provider?: ExecutionProvider;
  signing_method?: SigningMethod;
  signing_order?: SigningOrder;
  sla_days?: number;
  effective_date?: string;
  metadata?: any;
}

export interface SendExecutionParams {
  execution_id: string;
  participants: {
    participant_type: ParticipantType;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
  }[];
  message?: string;
  send_whatsapp?: boolean;
  send_email?: boolean;
}

export interface ExecutionResult {
  success: boolean;
  execution_id: string;
  status: ExecutionStatus;
  message?: string;
  errors?: string[];
  warnings?: string[];
  data?: any;
}

export interface ReadyScoreResult {
  score: number;
  checks: {
    key: string;
    label: string;
    passed: boolean;
    required: boolean;
    message?: string;
  }[];
  can_proceed: boolean;
}

// ============================================================
// Context for Engine Operations
// ============================================================

export interface ExecutionContext {
  supabase: SupabaseClient;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}
