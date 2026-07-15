// lib/platform/notifications/engine.ts
// Notification Engine - Core notification orchestration

import { v4 as uuidv4 } from 'uuid';
import { subscribe, publish } from '../events/event-bus';
import { WhatsAppChannel } from './channels/whatsapp';
import { EmailChannel } from './channels/email';
import { InAppChannel } from './channels/in-app';
import { getTemplate } from './templates';
import { getUserPreferences } from './preferences';
import type { Notification, NotificationRequest, NotificationChannel, NotificationStatus } from './types';

export class NotificationEngine {
  private whatsappChannel: WhatsAppChannel;
  private emailChannel: EmailChannel;
  private inAppChannel: InAppChannel;
  private initialized = false;

  constructor() {
    this.whatsappChannel = new WhatsAppChannel();
    this.emailChannel = new EmailChannel();
    this.inAppChannel = new InAppChannel();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    subscribe('notification.requested', async (event) => {
      await this.send(event.payload as NotificationRequest);
    });

    this.initialized = true;
    console.log('Notification Engine initialized');
  }

  async send(request: NotificationRequest): Promise<void> {
    const channels = request.channels || ['in_app'];
    const priority = request.priority || 'medium';
    const correlationId = request.correlation_id || uuidv4();

    const template = getTemplate(request.event);
    if (!template) {
      console.warn(`No template found for event: ${request.event}`);
      return;
    }

    const userPrefs = await getUserPreferences(request.recipient);
    const allowedChannels = channels.filter(channel => {
      if (userPrefs?.channels[channel] === false) return false;
      if (userPrefs?.events?.[request.event]?.enabled === false) return false;
      return true;
    });

    for (const channel of allowedChannels) {
      const notification: Notification = {
        id: uuidv4(),
        event: request.event,
        recipient: request.recipient,
        recipient_type: request.recipient_type,
        channel,
        template: template.id,
        data: request.data,
        status: 'queued',
        retry_count: 0,
        correlation_id: correlationId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await this.storeNotification(notification);
      await this.deliver(notification);
    }
  }

  private async deliver(notification: Notification): Promise<void> {
    try {
      switch (notification.channel) {
        case 'whatsapp':
          await this.whatsappChannel.send(notification);
          break;
        case 'email':
          await this.emailChannel.send(notification);
          break;
        case 'in_app':
          await this.inAppChannel.send(notification);
          break;
        default:
          console.warn(`Unknown channel: ${notification.channel}`);
          return;
      }

      await this.updateStatus(notification.id, 'sent');
    } catch (error) {
      console.error(`Failed to deliver notification ${notification.id}:`, error);
      await this.updateStatus(notification.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async storeNotification(notification: Notification): Promise<void> {
    // Store in Supabase - implementation depends on your Supabase client setup
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = createClient();
      
      const { error } = await supabase
        .from('notifications_log')
        .insert({
          id: notification.id,
          event: notification.event,
          recipient: notification.recipient,
          recipient_type: notification.recipient_type,
          channel: notification.channel,
          template: notification.template,
          data: notification.data,
          status: notification.status,
          retry_count: notification.retry_count,
          correlation_id: notification.correlation_id,
          created_at: notification.created_at,
          updated_at: notification.updated_at,
        });

      if (error) {
        console.error('Failed to store notification:', error);
      }
    } catch (error) {
      console.error('Failed to store notification:', error);
    }
  }

  private async updateStatus(
    notificationId: string,
    status: NotificationStatus,
    error?: string
  ): Promise<void> {
    try {
      const { createClient } = await import('@/lib/supabase/server');
      const supabase = createClient();
      
      const updates: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'sent') updates.sent_at = new Date().toISOString();
      if (status === 'delivered') updates.delivered_at = new Date().toISOString();
      if (status === 'read') updates.read_at = new Date().toISOString();
      if (status === 'failed') {
        updates.failed_at = new Date().toISOString();
        updates.error = error;
      }

      await supabase
        .from('notifications_log')
        .update(updates)
        .eq('id', notificationId);
    } catch (error) {
      console.error('Failed to update notification status:', error);
    }
  }
}

export const notificationEngine = new NotificationEngine();
