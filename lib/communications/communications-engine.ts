// lib/communications/communications-engine.ts
// Communications Engine — Queues messages, never delivers directly

import { supabase } from '@/lib/supabase';
import { resolveRecipient } from './services/recipient-resolver';
import { resolvePreferences } from './services/preference-resolver';
import { getTemplateBody, getTemplateSubject } from './template-engine';
import { publish } from '@/lib/platform/events/event-bus';
import { logger } from '@/lib/platform/events/logger.service';

export type CommunicationType = 
  | 'statement' | 'invoice' | 'receipt' | 'lease' 
  | 'maintenance' | 'inspection' | 'otp' | 'welcome' | 'reminder';

export interface CommunicationRequest {
  tenantId: string;
  entityId: string;
  type: CommunicationType;
  channels?: ('email' | 'whatsapp' | 'sms')[];
  templateData?: Record<string, string>;
  attachments?: Array<{ filename: string; content: string; type: string }>;
  scheduledFor?: string;
}

export class CommunicationsEngine {

  async send(request: CommunicationRequest): Promise<string[]> {
    const ids: string[] = [];

    // 1. Resolve recipient
    const recipient = await resolveRecipient(request.tenantId);
    if (!recipient) {
      logger.warn('Recipient not found', { tenantId: request.tenantId });
      return ids;
    }

    // 2. Resolve preferences
    const prefs = await resolvePreferences(request.tenantId, request.entityId);
    const channels = request.channels || prefs.preferredChannels;

    for (const channel of channels) {
      if (channel === 'email' && (!prefs.emailEnabled || !recipient.email)) continue;
      if (channel === 'whatsapp' && (!prefs.whatsappEnabled || !recipient.whatsappNumber)) continue;

      // 3. Render template
      const templateId = `${request.type}_ready_${channel}`;
      const body = await getTemplateBody(request.entityId, templateId, request.templateData || {});
      const subject = await getTemplateSubject(request.entityId, templateId, request.templateData || {});

      // 4. Queue — never deliver directly
      const { data } = await supabase.from('communications_queue').insert({
        entity_id: request.entityId,
        tenant_id: request.tenantId,
        type: request.type,
        channel,
        recipient: channel === 'email' ? recipient.email! : recipient.whatsappNumber!,
        subject: subject || null,
        body,
        status: 'queued',
        scheduled_for: request.scheduledFor || new Date().toISOString(),
      }).select('id').single();

      if (data) ids.push(data.id);
    }

    if (ids.length > 0) {
      await publish('communication.queued', {
        correlationId: crypto.randomUUID(),
        source: 'communications-engine',
        version: '1.0',
        payload: { tenantId: request.tenantId, type: request.type, queueIds: ids, count: ids.length },
      });
    }

    return ids;
  }
}

export const communicationsEngine = new CommunicationsEngine();
