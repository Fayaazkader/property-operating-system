// lib/communications/providers/sendgrid-email.ts
// SendGrid Email Provider

import type { EmailProvider } from './types';
import { logger } from '@/lib/platform/events/logger.service';

export class SendGridEmailProvider implements EmailProvider {
  name = 'sendgrid';
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY || '';
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'statements@assetflow.africa';
    this.fromName = process.env.SENDGRID_FROM_NAME || 'AssetFlow';
  }

  async send(params: {
    to: string; subject: string; text: string; html: string;
    attachments?: Array<{ filename: string; content: string; type: string }>;
  }): Promise<{ success: boolean; messageId: string; error?: string }> {
    if (!this.apiKey) {
      return { success: false, messageId: '', error: 'SendGrid not configured' };
    }

    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(this.apiKey);

      const msg: any = {
        to: params.to,
        from: { email: this.fromEmail, name: this.fromName },
        subject: params.subject,
        text: params.text,
        html: params.html,
      };

      if (params.attachments?.length) {
        msg.attachments = params.attachments;
      }

      await sgMail.send(msg);
      logger.info('Email sent via SendGrid', { to: params.to, subject: params.subject });
      return { success: true, messageId: crypto.randomUUID() };
    } catch (error) {
      logger.error('SendGrid email failed', { error, to: params.to });
      return { success: false, messageId: '', error: error instanceof Error ? error.message : 'Unknown' };
    }
  }

  async getStatus(_messageId: string): Promise<{ status: string; error?: string }> {
    return { status: 'delivered' };
  }
}
