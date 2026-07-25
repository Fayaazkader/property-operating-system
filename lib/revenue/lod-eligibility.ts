// lib/revenue/lod-eligibility.ts
// Checks whether a tenant is eligible for a specific LOD template

import { supabase } from '@/lib/supabase';

export interface LODEligibility {
  tenantId: string;
  tenantName: string;
  overdueAmount: number;
  daysOverdue: number;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  leaseRef: string;
  propertyName: string;
  eligible: boolean;
  matchedTemplateId?: string;
  matchedTemplateName?: string;
}

export const lodEligibility = {
  async checkTenant(tenantId: string, templateId: string): Promise<LODEligibility | null> {
    const { data: template } = await supabase.from('lod_templates').select('*').eq('id', templateId).single();
    if (!template) return null;

    return checkEligibility(tenantId, template);
  },

  async findEligible(entityId: string): Promise<LODEligibility[]> {
    const { data: templates } = await supabase.from('lod_templates').select('*').eq('entity_id', entityId).eq('is_active', true);
    if (!templates?.length) return [];

    const { data: overdueEntries } = await supabase
      .from('sub_ledger_entries')
      .select('tenant_id, running_balance, posted_at')
      .eq('entity_id', entityId)
      .eq('ledger_type', 'tenant')
      .gt('running_balance', 0)
      .order('posted_at', { ascending: true });

    if (!overdueEntries?.length) return [];

    const tenantMap = new Map<string, { balance: number; oldestDate: string }>();
    for (const e of overdueEntries) {
      if (!tenantMap.has(e.tenant_id)) tenantMap.set(e.tenant_id, { balance: e.running_balance, oldestDate: e.posted_at });
    }

    const results: LODEligibility[] = [];
    for (const [tid, data] of tenantMap) {
      for (const tpl of templates) {
        const eligibility = await checkEligibility(tid, tpl, data);
        if (eligibility?.eligible) results.push(eligibility);
        break; // One template match is enough
      }
    }
    return results;
  }
};

async function checkEligibility(tenantId: string, template: any, preloadedData?: { balance: number; oldestDate: string }): Promise<LODEligibility | null> {
  const data = preloadedData || await getTenantOverdueData(tenantId);
  if (!data || data.balance < (template.min_amount || 0)) return null;

  const daysOverdue = Math.floor((Date.now() - new Date(data.oldestDate).getTime()) / (1000 * 60 * 60 * 24));
  if (daysOverdue < (template.trigger_days || 30)) return null;

  const { data: tenant } = await supabase.from('tenants').select('tenant_name').eq('id', tenantId).single();
  const { data: lease } = await supabase.from('leases').select('lease_id, property_name').eq('tenant_id', tenantId).eq('lease_status', 'Active').single();
  const { data: lastPayment } = await supabase.from('sub_ledger_entries').select('credit_amount, posted_at').eq('tenant_id', tenantId).eq('ledger_type', 'tenant').gt('credit_amount', 0).order('posted_at', { ascending: false }).limit(1).single();

  return {
    tenantId, tenantName: tenant?.tenant_name || 'Unknown',
    overdueAmount: data.balance, daysOverdue,
    lastPaymentDate: lastPayment?.posted_at || null,
    lastPaymentAmount: lastPayment?.credit_amount || null,
    leaseRef: lease?.lease_id || 'N/A', propertyName: lease?.property_name || 'Unknown',
    eligible: true, matchedTemplateId: template.id, matchedTemplateName: template.name,
  };
}

async function getTenantOverdueData(tenantId: string) {
  const { data } = await supabase.from('sub_ledger_entries').select('running_balance, posted_at').eq('tenant_id', tenantId).eq('ledger_type', 'tenant').gt('running_balance', 0).order('posted_at', { ascending: true }).limit(1).single();
  return data ? { balance: data.running_balance, oldestDate: data.posted_at } : null;
}
