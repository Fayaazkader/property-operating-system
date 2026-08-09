// lib/platform/notifications/channels/email.ts
// Email Channel Adapter — SendGrid integration

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
    this.config = {
      enabled: config.enabled ?? true,
      apiKey: config.apiKey || process.env.SENDGRID_API_KEY,
      fromEmail: config.fromEmail || process.env.SENDGRID_FROM_EMAIL || 'statements@assetflow.africa',
      fromName: config.fromName || process.env.SENDGRID_FROM_NAME || 'AssetFlow',
    };
  }

  async send(notification: Notification, content: string): Promise<{ success: boolean; deliveryId: string; error?: string }> {
    const deliveryId = crypto.randomUUID();

    if (!this.config.enabled) {
      logger.warn('Email channel is disabled', { notificationId: notification.id });
      return { success: false, deliveryId, error: 'Email channel is disabled' };
    }

    if (!this.config.apiKey) {
      logger.warn('SendGrid API key not configured', { notificationId: notification.id });
      return { success: false, deliveryId, error: 'Email not configured' };
    }

    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(this.config.apiKey);

      await sgMail.send({
        to: notification.recipient,
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName,
        },
        subject: notification.data?.subject || 'AssetFlow Notification',
        text: content.replace(/<[^>]*>/g, ''),
        html: content,
      });

      logger.info('📧 Email sent', {
        notificationId: notification.id,
        recipient: notification.recipient,
      });

      return { success: true, deliveryId };
    } catch (error) {
      logger.error('Email send failed:', { error, notificationId: notification.id });
      return { 
        success: false, 
        deliveryId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async getStatus(_deliveryId: string): Promise<{ status: string; error?: string }> {
    return { status: 'delivered' };
  }

  supports(notification: Notification): boolean {
    return this.config.enabled && !!notification.recipient;
  }
}
