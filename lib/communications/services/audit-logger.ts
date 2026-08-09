// lib/communications/services/audit-logger.ts
// Logs all communications to the audit trail

import { supabase } from '@/lib/supabase';

export async function logCommunication(params: {
  tenantId: string;
  type: string;
  channels: string[];
  body: string;
  status: string;
  sourceId?: string;
}): Promise<void> {
  await supabase.from('communications').insert({
    tenant_id: params.tenantId,
    event_type: `${params.type}_sent`,
    channel: params.channels.join(','),
    message_body: params.body.substring(0, 500),
    status: params.status,
    source_type: params.type,
    source_id: params.sourceId || null,
  });
}
