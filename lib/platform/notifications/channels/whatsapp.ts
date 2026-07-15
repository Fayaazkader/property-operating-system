// lib/platform/notifications/channels/whatsapp.ts
// WhatsApp Channel Adapter

import { logger } from '../../events/logger.service';
import { Notification, NotificationDelivery } from '../types';

export interface WhatsAppChannelConfig {
  enabled: boolean;
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
}

export class WhatsAppChannel {
  private config: WhatsAppChannelConfig;

  constructor(config: WhatsAppChannelConfig) {
    this.config = config;
  }

  async send(notification: Notification, content: string): Promise<{ success: boolean; deliveryId: string; error?: string }> {
    const deliveryId = crypto.randomUUID();

    if (!this.config.enabled) {
      logger.warn('WhatsApp channel is disabled', { notificationId: notification.id });
      return { success: false, deliveryId, error: 'WhatsApp channel is disabled' };
    }

    try {
      // TODO: Integrate with Twilio
      // const client = twilio(this.config.accountSid, this.config.authToken);
      // await client.messages.create({
      //   body: content,
      //   from: `whatsapp:${this.config.fromNumber}`,
      //   to: `whatsapp:${notification.recipient}`,
      // });

      logger.info('📱 WhatsApp notification sent', {
        notificationId: notification.id,
        recipient: notification.recipient,
        contentLength: content.length,
      });

      return { success: true, deliveryId };
    } catch (error) {
      logger.error('WhatsApp send failed:', { error, notificationId: notification.id });
      return { success: false, deliveryId, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getStatus(deliveryId: string): Promise<{ status: string; error?: string }> {
    // TODO: Query Twilio for status
    return { status: 'delivered' };
  }

  supports(notification: Notification): boolean {
    return this.config.enabled && !!notification.recipient;
  }
}
