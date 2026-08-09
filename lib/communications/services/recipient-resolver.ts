// lib/communications/services/recipient-resolver.ts
// Resolves tenant contact info for communication

import { supabase } from '@/lib/supabase';

export interface Recipient {
  tenantId: string;
  tenantName: string;
  email?: string;
  whatsappNumber?: string;
}

export async function resolveRecipient(tenantId: string): Promise<Recipient | null> {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('tenant_name, email, whatsapp_number')
    .eq('id', tenantId)
    .single();

  if (!tenant) return null;

  return {
    tenantId,
    tenantName: tenant.tenant_name || 'Tenant',
    email: tenant.email || undefined,
    whatsappNumber: tenant.whatsapp_number || undefined,
  };
}
