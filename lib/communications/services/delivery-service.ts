// lib/communications/services/delivery-service.ts
// Handles actual sending via providers

import { getEmailProvider, getWhatsAppProvider } from '../providers/registry';
import { logger } from '@/lib/platform/events/logger.service';

export interface DeliveryRequest {
  channel: 'email' | 'whatsapp' | 'sms';
  recipient: string;
  subject?: string;
  body: string;
  attachments?: Array<{ filename: string; content: string; type: string }>;
}

export interface DeliveryResult {
  channel: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function deliver(request: DeliveryRequest): Promise<DeliveryResult> {
  try {
    if (request.channel === 'email') {
      const provider = getEmailProvider();
      const result = await provider.send({
        to: request.recipient,
        subject: request.subject || 'AssetFlow',
        text: request.body.replace(/<[^>]*>/g, ''),
        html: request.body,
        attachments: request.attachments,
      });
      return { channel: 'email', success: result.success, messageId: result.messageId, error: result.error };
    }

    if (request.channel === 'whatsapp') {
      const provider = getWhatsAppProvider();
      const result = await provider.send(request.recipient, request.body);
      return { channel: 'whatsapp', success: result.success, messageId: result.messageId, error: result.error };
    }

    return { channel: request.channel, success: false, error: 'Unsupported channel' };
  } catch (error) {
    logger.error('Delivery failed', { error, channel: request.channel });
    return { channel: request.channel, success: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}
