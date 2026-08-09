// lib/platform/notifications/channels/whatsapp.ts
// WhatsApp Channel Adapter — Twilio integration

import { logger } from '../../events/logger.service';
import { Notification } from '../types';

export interface WhatsAppChannelConfig {
  enabled: boolean;
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
}

export class WhatsAppChannel {
  private config: WhatsAppChannelConfig;

  constructor(config: WhatsAppChannelConfig) {
    this.config = {
      enabled: config.enabled ?? true,
      accountSid: config.accountSid || process.env.TWILIO_ACCOUNT_SID,
      authToken: config.authToken || process.env.TWILIO_AUTH_TOKEN,
      fromNumber: config.fromNumber || process.env.TWILIO_WHATSAPP_NUMBER,
    };
  }

  async send(notification: Notification, content: string): Promise<{ success: boolean; deliveryId: string; error?: string }> {
    const deliveryId = crypto.randomUUID();

    if (!this.config.enabled) {
      logger.warn('WhatsApp channel is disabled', { notificationId: notification.id });
      return { success: false, deliveryId, error: 'WhatsApp channel is disabled' };
    }

    if (!this.config.accountSid || !this.config.authToken) {
      logger.warn('WhatsApp credentials not configured', { notificationId: notification.id });
      return { success: false, deliveryId, error: 'WhatsApp not configured' };
    }

    try {
      const { default: twilio } = await import('twilio');
      const client = twilio(this.config.accountSid, this.config.authToken);

      const message = await client.messages.create({
        body: content,
        from: `whatsapp:${this.config.fromNumber}`,
        to: `whatsapp:${notification.recipient}`,
      });

      logger.info('📱 WhatsApp message sent', {
        notificationId: notification.id,
        recipient: notification.recipient,
        twilioSid: message.sid,
        status: message.status,
      });

      return { success: true, deliveryId: message.sid };
    } catch (error) {
      logger.error('WhatsApp send failed:', { error, notificationId: notification.id });
      return { 
        success: false, 
        deliveryId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async getStatus(deliveryId: string): Promise<{ status: string; error?: string }> {
    try {
      const { default: twilio } = await import('twilio');
      const client = twilio(this.config.accountSid, this.config.authToken);
      const message = await client.messages(deliveryId).fetch();
      return { status: message.status };
    } catch (error) {
      return { status: 'unknown', error: error instanceof Error ? error.message : 'Unknown' };
    }
  }

  supports(notification: Notification): boolean {
    return this.config.enabled && !!notification.recipient;
  }
}
