// lib/communications/statement-delivery.ts
// Statement Delivery — Send statements via email and WhatsApp

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';

export interface StatementDeliveryRequest {
  tenantId: string;
  tenantName: string;
  statementUrl: string;
  email?: string;
  whatsappNumber?: string;
  entityId: string;
  message?: string;
}

export async function deliverStatement(params: StatementDeliveryRequest) {
  const channels: string[] = [];
  
  if (params.email) channels.push('email');
  if (params.whatsappNumber) channels.push('whatsapp');

  for (const channel of channels) {
    await publish('notification.requested', {
      correlationId: crypto.randomUUID(),
      source: 'statement-delivery',
      version: '1.0',
      payload: {
        event: 'statement.generated',
        recipient: channel === 'email' ? params.email! : params.whatsappNumber!,
        recipient_type: 'tenant',
        channels: [channel],
        data: {
          subject: `Your Statement - ${params.tenantName}`,
          title: 'Statement Ready',
          tenantName: params.tenantName,
          message: params.message || `Dear ${params.tenantName},\n\nYour latest statement is now available.\n\nView your statement here: ${params.statementUrl}\n\nThank you,\nAssetFlow`,
          link: params.statementUrl,
        },
      },
    });
  }

  // Log communication
  await supabase.from('communications').insert({
    tenant_id: params.tenantId,
    event_type: 'statement_sent',
    channel: channels.join(','),
    message_body: `Statement sent via ${channels.join(' and ')}`,
    status: 'delivered',
  });
}
