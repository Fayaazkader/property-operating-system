// lib/communications/communications-engine.ts
// Communications Engine — Thin orchestrator. Delegates to services.

import { resolveRecipient } from './services/recipient-resolver';
import { resolvePreferences } from './services/preference-resolver';
import { deliver } from './services/delivery-service';
import { logCommunication } from './services/audit-logger';
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
}

export class CommunicationsEngine {

  async send(request: CommunicationRequest): Promise<void> {
    // 1. Resolve recipient
    const recipient = await resolveRecipient(request.tenantId);
    if (!recipient) {
      logger.warn('Recipient not found', { tenantId: request.tenantId });
      return;
    }

    // 2. Resolve preferences
    const prefs = await resolvePreferences(request.tenantId, request.entityId);
    const channels = request.channels || prefs.preferredChannels;

    // 3. Queue communication request
    await publish('communication.requested', {
      correlationId: crypto.randomUUID(),
      source: 'communications-engine',
      version: '1.0',
      payload: { ...request, recipient, preferences: prefs },
    });

    const results: string[] = [];

    for (const channel of channels) {
      // Skip disabled channels
      if (channel === 'email' && !prefs.emailEnabled) continue;
      if (channel === 'whatsapp' && !prefs.whatsappEnabled) continue;
      if (!recipient.email && channel === 'email') continue;
      if (!recipient.whatsappNumber && channel === 'whatsapp') continue;

      // 4. Get template
      const templateId = `${request.type}_ready_${channel}`;
      const body = await getTemplateBody(request.entityId, templateId, request.templateData || {});
      const subject = await getTemplateSubject(request.entityId, templateId, request.templateData || {});

      // 5. Deliver
      const result = await deliver({
        channel,
        recipient: channel === 'email' ? recipient.email! : recipient.whatsappNumber!,
        subject,
        body,
        attachments: request.attachments,
      });

      results.push(`${channel}:${result.success ? 'sent' : 'failed'}`);
    }

    // 6. Audit
    const status = results.length === 0 ? 'skipped' 
      : results.every(r => r.includes('sent')) ? 'delivered' 
      : results.every(r => r.includes('failed')) ? 'failed' 
      : 'partial';

    await logCommunication({
      tenantId: request.tenantId,
      type: request.type,
      channels: channels,
      body: request.templateData?.body || '',
      status,
      sourceId: request.templateData?.sourceId,
    });

    // 7. Publish result
    await publish('communication.sent', {
      correlationId: crypto.randomUUID(),
      source: 'communications-engine',
      version: '1.0',
      payload: { tenantId: request.tenantId, type: request.type, results, status },
    });
  }
}

export const communicationsEngine = new CommunicationsEngine();
