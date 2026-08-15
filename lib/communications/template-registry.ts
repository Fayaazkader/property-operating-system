// lib/communications/template-registry.ts
// Central communications template registry

import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export type TemplateCategory = 'revenue' | 'lease' | 'operations' | 'documents' | 'flow';
export type TemplateChannel = 'whatsapp' | 'email' | 'sms';
export type TemplateStatus = 'pending' | 'approved' | 'rejected' | 'active';

// Database row shape — one row per key+channel+version
export interface CommunicationTemplateRow {
  id: string;
  template_key: string;
  name: string;
  category: TemplateCategory;
  description: string | null;
  channel: TemplateChannel;
  provider: string;
  provider_template_name: string | null;
  provider_template_id: string | null;
  language: string;
  status: TemplateStatus;
  version: number;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Canonical catalogue — the controlled vocabulary
export const COMMUNICATION_TEMPLATES = [
  { template_key: 'invoice_ready', category: 'revenue', name: 'Invoice Ready', description: 'Tenant invoice issued', variables: ['tenant_name', 'invoice_number', 'amount', 'due_date', 'document_url'] },
  { template_key: 'statement_ready', category: 'revenue', name: 'Statement Ready', description: 'Tenant statement available', variables: ['tenant_name', 'period', 'document_url'] },
  { template_key: 'payment_received', category: 'revenue', name: 'Payment Received', description: 'Tenant payment confirmed', variables: ['tenant_name', 'amount', 'reference'] },
  { template_key: 'payment_reminder', category: 'revenue', name: 'Payment Reminder', description: 'Payment approaching', variables: ['tenant_name', 'amount', 'due_date'] },
  { template_key: 'payment_overdue', category: 'revenue', name: 'Payment Overdue', description: 'Payment overdue', variables: ['tenant_name', 'amount', 'days_overdue', 'action_url'] },
  { template_key: 'receipt_ready', category: 'revenue', name: 'Receipt Ready', description: 'Receipt available', variables: ['tenant_name', 'amount', 'document_url'] },
  { template_key: 'lease_renewal', category: 'lease', name: 'Lease Renewal', description: 'Renewal approaching', variables: ['tenant_name', 'property_name', 'expiry_date', 'action_url'] },
  { template_key: 'lease_expiry', category: 'lease', name: 'Lease Expiry', description: 'Lease approaching expiry', variables: ['tenant_name', 'property_name', 'expiry_date'] },
  { template_key: 'signature_required', category: 'lease', name: 'Signature Required', description: 'Signature needed', variables: ['tenant_name', 'document_name', 'signing_url'] },
  { template_key: 'document_ready', category: 'lease', name: 'Document Ready', description: 'Lease document available', variables: ['tenant_name', 'document_name', 'document_url'] },
  { template_key: 'request_received', category: 'operations', name: 'Request Received', description: 'Request acknowledged', variables: ['tenant_name', 'request_type', 'reference'] },
  { template_key: 'request_update', category: 'operations', name: 'Request Update', description: 'Request status changed', variables: ['tenant_name', 'request_type', 'status'] },
  { template_key: 'maintenance_complete', category: 'operations', name: 'Maintenance Complete', description: 'Maintenance finished', variables: ['tenant_name', 'work_order', 'completion_date'] },
  { template_key: 'document_available', category: 'documents', name: 'Document Available', description: 'Document available', variables: ['tenant_name', 'document_name', 'document_url'] },
  { template_key: 'transaction_history', category: 'documents', name: 'Transaction History', description: 'Transaction history available', variables: ['tenant_name', 'period', 'document_url'] },
  { template_key: 'report_ready', category: 'documents', name: 'Report Ready', description: 'Report available', variables: ['tenant_name', 'report_name', 'document_url'] },
] as const;

export type CommunicationTemplateKey = typeof COMMUNICATION_TEMPLATES[number]['key'];

// Server-side lookup
export async function getTemplateConfig(
  key: string,
  channel: TemplateChannel,
  db: SupabaseClient = supabase
): Promise<CommunicationTemplateRow | null> {
  const { data } = await db
    .from('communication_templates')
    .select('*')
    .eq('template_key', key)
    .eq('channel', channel)
    .eq('is_active', true)
    .eq('status', 'approved')
    .order('version', { ascending: false })
    .limit(1)
    .single();

  return data as CommunicationTemplateRow | null;
}
