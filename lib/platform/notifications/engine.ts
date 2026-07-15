// lib/platform/notifications/engine.ts
// Notification Engine — Core

import { supabase } from "@/lib/supabase";
import { subscribe, publish } from "../events/event-bus";
import { logger } from "../events/logger.service";
import {
  Notification,
  NotificationRequest,
  NotificationDelivery,
  NotificationStatus,
  NotificationChannel,
} from './types';
import { getTemplate, renderTemplate } from './templates';
import { notificationPreferences } from './preferences';
import { WhatsAppChannel, EmailChannel, InAppChannel } from './channels';

export class NotificationEngine {
  private supabase = supabase;
  private whatsappChannel: WhatsAppChannel;
  private emailChannel: EmailChannel;
  private inAppChannel: InAppChannel;
  private isInitialized: boolean = false;

  constructor() {
    this.whatsappChannel = new WhatsAppChannel({
      enabled: true,
    });
    this.emailChannel = new EmailChannel({
      enabled: true,
      fromEmail: 'notifications@assetflow.africa',
      fromName: 'AssetFlow',
    });
    this.inAppChannel = new InAppChannel();
  }

  initialize(): void {
    if (this.isInitialized) return;
    
    subscribe('notification.requested', async (event) => {
      const payload = event.payload || {};
      logger.info('📨 Notification requested', {
        event: payload.event,
        recipient: payload.recipient,
        correlationId: event.correlationId,
      });

      await this.send({
        event: payload.event,
        recipient: payload.recipient,
        recipient_type: payload.recipient_type || 'user',
        data: payload.data || {},
        channels: payload.channels,
        priority: payload.priority || 'medium',
        correlation_id: event.correlationId,
      });
    });

    this.isInitialized = true;
    logger.info('✅ Notification Engine initialized');
  }

  async send(request: NotificationRequest): Promise<Notification> {
    const correlationId = request.correlation_id || crypto.randomUUID();

    const template = getTemplate(request.event);
    if (!template) {
      logger.warn('No template found for event:', { event: request.event });
      return this.sendFallback(request, correlationId);
    }

    let channels = request.channels || [template.default_channel];
    
    channels = channels.filter(c => {
      return notificationPreferences.shouldSend(
        request.recipient,
        request.recipient_type,
        request.event,
        c
      );
    });

    if (channels.length === 0) {
      logger.info('No channels available for notification', {
        event: request.event,
        recipient: request.recipient,
      });
      return this.createNotification(request, 'queued', correlationId, 'skipped');
    }

    const notification = await this.createNotification(request, 'queued', correlationId);

    const deliveries: NotificationDelivery[] = [];
    for (const channel of channels) {
      const delivery = await this.sendViaChannel(notification, channel);
      deliveries.push(delivery);
    }

    const allSuccess = deliveries.every(d => d.status === 'delivered' || d.status === 'sent');
    const allFailed = deliveries.every(d => d.status === 'failed');

    let status: NotificationStatus = 'sent';
    if (allFailed) status = 'failed';
    else if (!allSuccess) status = 'sent';

    await this.updateNotification(notification.id, status, deliveries);

    await publish('notification.delivered', {
      correlationId,
      source: 'notification-engine',
      version: '1.0',
      payload: {
        notificationId: notification.id,
        status,
        deliveries,
      },
    });

    return notification;
  }

  private async sendViaChannel(
    notification: Notification,
    channel: NotificationChannel
  ): Promise<NotificationDelivery> {
    const deliveryId = crypto.randomUUID();
    const content = this.renderContent(notification);

    let result: { success: boolean; deliveryId: string; error?: string };

    switch (channel) {
      case 'whatsapp':
        result = await this.whatsappChannel.send(notification, content);
        break;
      case 'email':
        result = await this.emailChannel.send(notification, content);
        break;
      case 'in_app':
        result = await this.inAppChannel.send(notification, content);
        break;
      default:
        result = { success: false, deliveryId, error: `Unsupported channel: ${channel}` };
    }

    const delivery: NotificationDelivery = {
      id: deliveryId,
      notification_id: notification.id,
      channel,
      status: result.success ? 'delivered' : 'failed',
      sent_at: new Date().toISOString(),
      delivered_at: result.success ? new Date().toISOString() : undefined,
      failed_at: result.error ? new Date().toISOString() : undefined,
      error: result.error,
      retry_count: 0,
      created_at: new Date().toISOString(),
    };

    await this.storeDelivery(delivery);

    logger.info('📨 Notification sent via channel', {
      notificationId: notification.id,
      channel,
      success: result.success,
    });

    return delivery;
  }

  private renderContent(notification: Notification): string {
    const template = getTemplate(notification.event);
    if (!template) {
      return JSON.stringify(notification.data, null, 2);
    }

    const channelTemplate = template.channels[notification.channel];
    if (!channelTemplate) {
      return JSON.stringify(notification.data, null, 2);
    }

    if (typeof channelTemplate === 'string') {
      return renderTemplate(channelTemplate, notification.data);
    }

    if (channelTemplate.subject && channelTemplate.body) {
      const renderedBody = renderTemplate(channelTemplate.body, notification.data);
      notification.data.subject = renderTemplate(channelTemplate.subject, notification.data);
      return renderedBody;
    }

    return JSON.stringify(notification.data, null, 2);
  }

  private async createNotification(
    request: NotificationRequest,
    status: NotificationStatus,
    correlationId: string,
    skipReason?: string
  ): Promise<Notification> {
    const notification: Notification = {
      id: crypto.randomUUID(),
      event: request.event,
      recipient: request.recipient,
      recipient_type: request.recipient_type,
      channel: 'in_app',
      template: request.event,
      data: request.data,
      status,
      retry_count: 0,
      correlation_id: correlationId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: skipReason ? { skipReason } : {},
    };

    await this.storeNotification(notification);
    return notification;
  }

  private async sendFallback(request: NotificationRequest, correlationId: string): Promise<Notification> {
    const notification = await this.createNotification(request, 'queued', correlationId);
    const content = JSON.stringify(request.data, null, 2);
    await this.emailChannel.send(notification, content);
    return notification;
  }

  private async storeNotification(notification: Notification): Promise<void> {
    try {
      await this.supabase.from('notifications_log').insert({
        id: notification.id,
        event: notification.event,
        recipient: notification.recipient,
        recipient_type: notification.recipient_type,
        status: notification.status,
        template: notification.template,
        data: notification.data,
        correlation_id: notification.correlation_id,
        metadata: notification.metadata || {},
        created_at: notification.created_at,
      });
    } catch (error) {
      logger.error('Failed to store notification:', { error });
    }
  }

  private async storeDelivery(delivery: NotificationDelivery): Promise<void> {
    try {
      await this.supabase.from('notification_deliveries').insert({
        id: delivery.id,
        notification_id: delivery.notification_id,
        channel: delivery.channel,
        status: delivery.status,
        sent_at: delivery.sent_at,
        delivered_at: delivery.delivered_at,
        read_at: delivery.read_at,
        failed_at: delivery.failed_at,
        error: delivery.error,
        retry_count: delivery.retry_count,
      });
    } catch (error) {
      logger.error('Failed to store delivery:', { error });
    }
  }

  private async updateNotification(
    id: string,
    status: NotificationStatus,
    deliveries: NotificationDelivery[]
  ): Promise<void> {
    try {
      await this.supabase
        .from('notifications_log')
        .update({
          status,
          updated_at: new Date().toISOString(),
          metadata: { deliveries },
        })
        .eq('id', id);
    } catch (error) {
      logger.error('Failed to update notification:', { error });
    }
  }
}

export const notificationEngine = new NotificationEngine();
