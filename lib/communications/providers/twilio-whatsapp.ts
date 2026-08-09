// lib/communications/providers/twilio-whatsapp.ts
// Twilio WhatsApp Provider

import type { WhatsAppProvider } from './types';
import { logger } from '@/lib/platform/events/logger.service';

export class TwilioWhatsAppProvider implements WhatsAppProvider {
  name = 'twilio';
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || '';
  }

  async send(to: string, message: string): Promise<{ success: boolean; messageId: string; error?: string }> {
    if (!this.accountSid || !this.authToken) {
      return { success: false, messageId: '', error: 'Twilio not configured' };
    }

    try {
      const { default: twilio } = await import('twilio');
      const client = twilio(this.accountSid, this.authToken);
      const msg = await client.messages.create({
        body: message,
        from: `whatsapp:${this.fromNumber}`,
        to: `whatsapp:${to}`,
      });

      logger.info('WhatsApp sent via Twilio', { to, sid: msg.sid, status: msg.status });
      return { success: true, messageId: msg.sid };
    } catch (error) {
      logger.error('Twilio WhatsApp failed', { error, to });
      return { success: false, messageId: '', error: error instanceof Error ? error.message : 'Unknown' };
    }
  }

  async getStatus(messageId: string): Promise<{ status: string; error?: string }> {
    try {
      const { default: twilio } = await import('twilio');
      const client = twilio(this.accountSid, this.authToken);
      const msg = await client.messages(messageId).fetch();
      return { status: msg.status };
    } catch (error) {
      return { status: 'unknown', error: error instanceof Error ? error.message : 'Unknown' };
    }
  }
}
