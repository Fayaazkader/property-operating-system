// lib/platform/notifications/preferences.ts
// Notification Preferences

import { supabase } from "@/lib/supabase";
import { NotificationPreference, NotificationChannel } from './types';
import { logger } from '../events/logger.service';

const DEFAULT_PREFERENCES: Partial<NotificationPreference> = {
  channels: {
    whatsapp: true,
    email: true,
    in_app: true,
    push: false,
    sms: false,
  },
  events: {},
};

export class NotificationPreferences {
  private supabase = supabase;
  private cache: Map<string, NotificationPreference> = new Map();

  async getPreferences(userId: string, entityId: string): Promise<NotificationPreference> {
    const key = `${userId}:${entityId}`;
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    try {
      const { data, error } = await this.supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('entity_id', entityId)
        .single();

      if (error || !data) {
        const defaults = this.getDefaults(userId, entityId);
        await this.createPreferences(userId, entityId, defaults);
        return defaults;
      }

      const preferences = data as NotificationPreference;
      this.cache.set(key, preferences);
      return preferences;
    } catch (error) {
      logger.error('Failed to get notification preferences:', { error });
      return this.getDefaults(userId, entityId);
    }
  }

  getDefaults(userId: string, entityId: string): NotificationPreference {
    return {
      user_id: userId,
      entity_id: entityId,
      channels: {
        whatsapp: true,
        email: true,
        in_app: true,
        push: false,
        sms: false,
      },
      events: {},
    };
  }

  async createPreferences(userId: string, entityId: string, preferences: NotificationPreference): Promise<void> {
    try {
      await this.supabase.from('notification_preferences').insert({
        user_id: userId,
        entity_id: entityId,
        preferences: preferences,
      });
      this.cache.set(`${userId}:${entityId}`, preferences);
    } catch (error) {
      logger.error('Failed to create notification preferences:', { error });
    }
  }

  async updatePreferences(
    userId: string,
    entityId: string,
    updates: Partial<NotificationPreference>
  ): Promise<void> {
    try {
      const current = await this.getPreferences(userId, entityId);
      const updated = { ...current, ...updates };
      
      await this.supabase
        .from('notification_preferences')
        .update({ preferences: updated })
        .eq('user_id', userId)
        .eq('entity_id', entityId);
      
      this.cache.set(`${userId}:${entityId}`, updated);
    } catch (error) {
      logger.error('Failed to update notification preferences:', { error });
    }
  }

  async shouldSend(
    userId: string,
    entityId: string,
    event: string,
    channel: NotificationChannel
  ): Promise<boolean> {
    const preferences = await this.getPreferences(userId, entityId);

    // Check quiet hours
    if (preferences.quiet_hours) {
      const now = new Date();
      const currentHour = now.getHours();
      const { start, end, timezone } = preferences.quiet_hours;
      // Simple check — could be enhanced with proper timezone handling
      if (currentHour >= parseInt(start) && currentHour < parseInt(end)) {
        return false;
      }
    }

    // Check event-specific settings
    const eventPref = preferences.events[event];
    if (eventPref) {
      if (!eventPref.enabled) return false;
      if (eventPref.channels && !eventPref.channels.includes(channel)) return false;
    }

    // Check global channel settings
    if (!preferences.channels[channel]) return false;

    return true;
  }

  async getChannelsForEvent(
    userId: string,
    entityId: string,
    event: string,
    defaultChannels: NotificationChannel[]
  ): Promise<NotificationChannel[]> {
    const preferences = await this.getPreferences(userId, entityId);

    const eventPref = preferences.events[event];
    if (eventPref && eventPref.channels && eventPref.channels.length > 0) {
      return eventPref.channels.filter(c => preferences.channels[c]);
    }

    return defaultChannels.filter(c => preferences.channels[c]);
  }
}

export const notificationPreferences = new NotificationPreferences();
