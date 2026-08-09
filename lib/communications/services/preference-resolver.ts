// lib/communications/services/preference-resolver.ts
// Resolves communication preferences for a tenant

import { supabase } from '@/lib/supabase';

export interface CommunicationPreferences {
  preferredChannels: ('email' | 'whatsapp' | 'sms')[];
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  quietHours?: { start: string; end: string };
  language?: string;
}

export async function resolvePreferences(tenantId: string, entityId: string): Promise<CommunicationPreferences> {
  // Default preferences
  const defaults: CommunicationPreferences = {
    preferredChannels: ['email'],
    emailEnabled: true,
    whatsappEnabled: false,
    smsEnabled: false,
  };

  // Get tenant overrides from communication_preferences table
  const { data } = await supabase
    .from('communication_preferences')
    .select('*')
    .eq('entity_id', entityId)
    .eq('tenant_id', tenantId)
    .single();

  if (!data) return defaults;

  return {
    preferredChannels: data.preferred_channels || defaults.preferredChannels,
    emailEnabled: data.email_enabled ?? defaults.emailEnabled,
    whatsappEnabled: data.whatsapp_enabled ?? defaults.whatsappEnabled,
    smsEnabled: data.sms_enabled ?? defaults.smsEnabled,
    quietHours: data.quiet_hours || undefined,
    language: data.language || undefined,
  };
}
