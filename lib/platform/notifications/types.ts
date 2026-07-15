// lib/platform/notifications/types.ts
// Notification Types

export type NotificationChannel = 'whatsapp' | 'email' | 'in_app' | 'push' | 'sms';
export type NotificationStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'retrying';

export interface Notification {
  id: string;
  event: string;
  recipient: string;
  recipient_type: 'user' | 'tenant' | 'broker' | 'supplier' | 'system';
  channel: NotificationChannel;
  template: string;
  data: Record<string, any>;
  status: NotificationStatus;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  failed_at?: string;
  retry_count: number;
  error?: string;
  correlation_id: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplate {
  id: string;
  event: string;
  channels: {
    whatsapp?: string;
    email?: { subject: string; body: string };
    in_app?: string;
    push?: string;
    sms?: string;
  };
  default_channel: NotificationChannel;
  priority: 'low' | 'medium' | 'high';
}

export interface NotificationPreference {
  user_id: string;
  entity_id: string;
  channels: {
    whatsapp: boolean;
    email: boolean;
    in_app: boolean;
    push: boolean;
    sms: boolean;
  };
  events: {
    [event: string]: {
      enabled: boolean;
      channels: NotificationChannel[];
    };
  };
  quiet_hours?: {
    start: string;
    end: string;
    timezone: string;
  };
}

export interface NotificationRequest {
  event: string;
  recipient: string;
  recipient_type: 'user' | 'tenant' | 'broker' | 'supplier' | 'system';
  data: Record<string, any>;
  channels?: NotificationChannel[];
  priority?: 'low' | 'medium' | 'high';
  correlation_id?: string;
}

export interface NotificationDelivery {
  id: string;
  notification_id: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  failed_at?: string;
  error?: string;
  retry_count: number;
  created_at: string;
}
