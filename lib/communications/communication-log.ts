// lib/communications/communication-log.ts
// Records every communication for audit trail and tenant timeline

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';

export interface CommunicationLogEntry {
  entity_id: string;
  tenant_id: string;
  lease_id?: string;
  channel: 'email' | 'whatsapp' | 'sms';
  direction: 'outbound' | 'inbound';
  template?: string;
  subject?: string;
  message_preview: string;
  document_url?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  provider_message_id?: string;
  error_message?: string;
  sent_by: string;
}

export async function logCommunication(entry: CommunicationLogEntry): Promise<void> {
  await supabase.from('communication_log').insert({
    ...entry,
    created_at: new Date().toISOString(),
  });

  await publish('communication.sent', {
    correlationId: crypto.randomUUID(),
    source: 'communication-service',
    version: '1.0',
    payload: entry,
  });
}

export async function updateCommunicationStatus(
  providerMessageId: string,
  status: 'delivered' | 'read' | 'failed',
  errorMessage?: string
): Promise<void> {
  await supabase
    .from('communication_log')
    .update({
      status,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('provider_message_id', providerMessageId);
}
