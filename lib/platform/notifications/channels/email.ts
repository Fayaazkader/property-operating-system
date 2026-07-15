// lib/platform/notifications/channels/email.ts
// Email Channel Adapter

import { logger } from '../../events/logger.service';
import { Notification } from '../types';

export interface EmailChannelConfig {
  enabled: boolean;
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
}

export class EmailChannel {
  private config: EmailChannelConfig;

  constructor(config: EmailChannelConfig) {
    this.config = config;
  }

  async send(notification: Notification, content: string): Promise<{ success: boolean; deliveryId: string; error?: string }> {
    const deliveryId = crypto.randomUUID();

    if (!this.config.enabled) {
      logger.warn('Email channel is disabled', { notificationId: notification.id });
      return { success: false, deliveryId, error: 'Email channel is disabled' };
    }

    try {
      // TODO: Integrate with SendGrid
      // const sgMail = require('@sendgrid/mail');
      // sgMail.setApiKey(this.config.apiKey);
      // await sgMail.send({
      //   to: notification.recipient,
      //   from: `${this.config.fromName} <${this.config.fromEmail}>`,
      //   subject: `AssetFlow: ${notification.data.subject || 'Notification'}`,
      //   text: content,
      //   html: content.replace(/\n/g, '<br>'),
      // });

      logger.info('📧 Email notification sent', {
        notificationId: notification.id,
        recipient: notification.recipient,
        contentLength: content.length,
      });

      return { success: true, deliveryId };
    } catch (error) {
      logger.error('Email send failed:', { error, notificationId: notification.id });
      return { success: false, deliveryId, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async getStatus(deliveryId: string): Promise<{ status: string; error?: string }> {
    // TODO: Query SendGrid for status
    return { status: 'delivered' };
  }

  supports(notification: Notification): boolean {
    return this.config.enabled && !!notification.recipient;
  }
}
