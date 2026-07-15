// lib/platform/notifications/channels/in-app.ts
// In-App Channel Adapter

import { supabase } from "@/lib/supabase";
import { logger } from '../../events/logger.service';
import { Notification } from '../types';

export class InAppChannel {
  private supabase = supabase;

  async send(notification: Notification, content: string): Promise<{ success: boolean; deliveryId: string; error?: string }> {
    const deliveryId = crypto.randomUUID();

    try {
      await this.supabase.from('notifications').insert({
        user_id: notification.recipient,
        title: notification.data.title || 'AssetFlow Notification',
        body: content,
        link: notification.data.link || null,
        source_type: notification.event,
        source_id: notification.data.source_id || null,
        read: false,
        created_at: new Date().toISOString(),
      });

      logger.info('📱 In-app notification created', {
        notificationId: notification.id,
        recipient: notification.recipient,
      });

      return { success: true, deliveryId };
    } catch (error) {
      logger.error('In-app notification failed:', { error, notificationId: notification.id });
      return { success: false, deliveryId, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  supports(notification: Notification): boolean {
    return !!notification.recipient;
  }
}
