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
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || '';
    this.fromName = process.env.SENDGRID_FROM_NAME || 'AssetFlow';
  }

  async send(params: {
    to: string; subject: string; text: string; html: string;
    attachments?: Array<{ filename: string; content: string; type: string }>;
  }): Promise<{ success: boolean; messageId: string; error?: string; definitiveRejection?: boolean }> {
    if (!this.apiKey || !this.fromEmail) {
      return { success: false, messageId: '', error: 'SendGrid not configured', definitiveRejection: true };
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

      const [response] = await sgMail.send(msg);
      const messageId = response.headers?.['x-message-id'];
      if (response.statusCode !== 202 || typeof messageId !== 'string' || !messageId) return { success: false, messageId: '', error: 'Provider acceptance requires reconciliation' };
      logger.info('Email sent via SendGrid', { to: params.to, subject: params.subject });
      return { success: true, messageId };
    } catch (error) {
      logger.error('SendGrid email failed', { error, to: params.to });
      return { success: false, messageId: '', error: 'Email submission failed', definitiveRejection: [400,401,403,404,413,415,422,429].includes((error as any)?.code) };
    }
  }

  async getStatus(_messageId: string): Promise<{ status: string; error?: string; definitiveRejection?: boolean }> {
    return { status: 'unknown', error: 'Delivery requires a verified provider event' };
  }
}
