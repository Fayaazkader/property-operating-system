// lib/communications/communications-engine.ts
// Communications Engine — Central hub for all outbound communications

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import { getWhatsAppProvider, getEmailProvider } from './providers/registry';
import { logger } from '@/lib/platform/events/logger.service';

export type CommunicationType = 
  | 'statement' | 'invoice' | 'receipt' | 'lease' 
  | 'maintenance' | 'inspection' | 'otp' | 'welcome' | 'reminder';

export interface CommunicationRequest {
  tenantId: string;
  entityId: string;
  type: CommunicationType;
  subject?: string;
  body: string;
  data?: Record<string, any>;
  channels?: ('email' | 'whatsapp' | 'sms')[];
  attachments?: Array<{ filename: string; content: string; type: string }>;
}

export class CommunicationsEngine {

  async send(request: CommunicationRequest): Promise<void> {
    // Get tenant contact info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('email, whatsapp_number, tenant_name')
      .eq('id', request.tenantId)
      .single();

    if (!tenant) {
      logger.warn('Tenant not found for communication', { tenantId: request.tenantId });
      return;
    }

    // Get tenant communication preferences
    const { data: prefs } = await supabase
      .from('statement_overrides')
      .select('*')
      .eq('entity_id', request.entityId)
      .eq('tenant_id', request.tenantId);

    const overrideMap: Record<string, string> = {};
    for (const p of (prefs || [])) { overrideMap[p.setting_key] = p.setting_value; }

    const channels = request.channels || ['email'];
    const results: string[] = [];

    // Send via email
    if (channels.includes('email') && tenant.email) {
      const emailProvider = getEmailProvider();
      const result = await emailProvider.send({
        to: tenant.email,
        subject: request.subject || `AssetFlow: ${request.type}`,
        text: request.body,
        html: request.body.replace(/\n/g, '<br>'),
        attachments: request.attachments,
      });
      results.push(`email:${result.success ? 'sent' : 'failed'}`);
    }

    // Send via WhatsApp
    if (channels.includes('whatsapp') && tenant.whatsapp_number) {
      const waProvider = getWhatsAppProvider();
      const result = await waProvider.send(tenant.whatsapp_number, request.body);
      results.push(`whatsapp:${result.success ? 'sent' : 'failed'}`);
    }

    // Log to communications audit trail
    await supabase.from('communications').insert({
      tenant_id: request.tenantId,
      event_type: `${request.type}_sent`,
      channel: channels.join(','),
      message_body: request.body.substring(0, 500),
      status: results.every(r => r.includes('sent')) ? 'delivered' : 'partial',
      source_type: request.type,
      source_id: request.data?.sourceId || null,
    });

    // Publish event
    await publish('communication.sent', {
      correlationId: crypto.randomUUID(),
      source: 'communications-engine',
      version: '1.0',
      payload: {
        tenantId: request.tenantId,
        type: request.type,
        channels,
        results,
      },
    });

    logger.info('Communication sent', {
      tenantId: request.tenantId,
      type: request.type,
      results: results.join(', '),
    });
  }
}

export const communicationsEngine = new CommunicationsEngine();
