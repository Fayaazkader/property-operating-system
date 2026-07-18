// lib/revenue/billing-assembly.ts
// Billing Assembly Engine — Builds complete billing worksheet from live data

import { supabase } from '@/lib/supabase';

export interface BillingCharge {
  type: string;
  description: string;
  amount: number;
  vatAmount: number;
  total: number;
  source: 'lease' | 'manual' | 'utility' | 'interest' | 'late_fee' | 'credit_note' | 'escalation';
  status: 'posted' | 'draft' | 'pending' | 'suggested';
  glCode?: string;
}

export interface BillingDocument {
  name: string;
  level: 'tenant' | 'property' | 'entity';
  url?: string;
  type: string;
  required?: boolean;
  viewed?: boolean;
}

export interface BillingTenant {
  tenantId: string;
  tenantName: string;
  property_name: string;
  leaseId: string;
  leaseRef: string;
  charges: BillingCharge[];
  documents: BillingDocument[];
  warnings: string[];
  total: number;
  ready: boolean;
}

export interface BillingWorksheet {
  property_name: string;
  tenants: BillingTenant[];
  totalCharges: number;
  readyCount: number;
  warningCount: number;
}

export interface BillingSnapshot {
  id: string;
  period: string;
  property_id: string;
  property_name: string;
  tenant_count: number;
  generated_at: string;
  invoices_generated: number;
  statements_generated: number;
  emails_delivered: number;
  whatsapp_delivered: number;
  failed: number;
}

export const billingAssembly = {
  async assembleWorksheet(entityId: string, propertyId?: string): Promise<BillingWorksheet> {
    let query = supabase.from('leases').select('id, tenant_id, tenant_name, property_name, lease_id, property_id').eq('lease_status', 'Active').eq('owner_entity_id', entityId);
    if (propertyId) query = query.eq('property_id', propertyId);
    const { data: leaseList } = await query;

    if (!leaseList?.length) return { property_name: '', tenants: [], totalCharges: 0, readyCount: 0, warningCount: 0 };

    const propertyName = leaseList[0].property_name;
    const tenants: BillingTenant[] = [];

    for (const lease of leaseList) {
      const charges: BillingCharge[] = [];
      const warnings: string[] = [];

      // 1. Lease billing rules
      const { data: rules } = await supabase.from('billing_rules').select('*').eq('lease_id', lease.id).eq('status', 'active');
      for (const r of (rules || [])) {
        const vat = Math.round(r.base_amount * (r.vat_rate / 100) * 100) / 100;
        charges.push({ type: r.rule_type, description: r.description, amount: r.base_amount, vatAmount: vat, total: r.base_amount + vat, source: 'lease', status: 'posted', glCode: r.gl_code });
      }

      // 2. Manual charges
      const { data: manuals } = await supabase.from('manual_charges').select('*').eq('tenant_id', lease.tenant_id).eq('status', 'posted');
      for (const m of (manuals || [])) {
        const vat = Math.round(m.amount * ((m.vat_rate || 15) / 100) * 100) / 100;
        charges.push({ type: 'manual', description: m.description, amount: m.amount, vatAmount: vat, total: m.amount + vat, source: 'manual', status: 'posted', glCode: m.gl_code });
      }

      // 3. Interest suggestions (draft — needs approval)
      const { data: interestSuggestions } = await supabase.from('interest_charges').select('*').eq('tenant_id', lease.tenant_id).eq('status', 'draft');
      for (const inv of (interestSuggestions || [])) {
        charges.push({ type: 'interest', description: `Interest — ${inv.description || 'Late Payment'}`, amount: inv.amount, vatAmount: 0, total: inv.amount, source: 'interest', status: 'suggested' });
        warnings.push('Interest charge pending approval');
      }

      // 4. Late fee suggestions
      const { data: lateFeeSuggestions } = await supabase.from('late_fee_charges').select('*').eq('tenant_id', lease.tenant_id).eq('status', 'draft');
      for (const lf of (lateFeeSuggestions || [])) {
        charges.push({ type: 'late_fee', description: `Late Fee — ${lf.description || 'Overdue'}`, amount: lf.amount, vatAmount: 0, total: lf.amount, source: 'late_fee', status: 'suggested' });
        warnings.push('Late fee pending approval');
      }

      // 5. Escalations effective this month
      // (placeholder — check escalation schedule)

      if (charges.length === 0) warnings.push('No billing rules');

      // Documents — tenant level + property level + entity level
      const docs: BillingDocument[] = [];
      const { data: tenantDocs } = await supabase.from('documents').select('file_name, file_url').eq('tenant_id', lease.tenant_id).limit(3);
      (tenantDocs || []).forEach(d => docs.push({ name: d.file_name, level: 'tenant', url: d.file_url, type: 'tenant_document' }));

      const { data: propertyDocs } = await supabase.from('documents').select('file_name, file_url').eq('related_entity_type', 'property').eq('related_entity_id', lease.property_id).limit(3);
      (propertyDocs || []).forEach(d => docs.push({ name: d.file_name, level: 'property', url: d.file_url, type: 'property_document' }));

      const total = charges.reduce((s, c) => s + c.total, 0);
      tenants.push({ tenantId: lease.tenant_id, tenantName: lease.tenant_name, property_name: lease.property_name, leaseId: lease.id,
      leaseRef: lease.lease_id, charges, documents: docs, warnings, total, ready: warnings.length === 0 });
    }

    return { property_name: propertyName, tenants, totalCharges: tenants.reduce((s, t) => s + t.total, 0), readyCount: tenants.filter(t => t.ready).length, warningCount: tenants.filter(t => !t.ready).length };
  },

  async saveSnapshot(params: { entity_id: string; period: string; property_id: string; property_name: string; tenant_count: number; invoices_generated: number; statements_generated: number; emails_delivered: number; whatsapp_delivered: number; failed: number }): Promise<void> {
    await supabase.from('billing_snapshots').insert({ ...params, id: crypto.randomUUID(), generated_at: new Date().toISOString() });
  },

  async getSnapshots(entityId: string, limit = 10): Promise<BillingSnapshot[]> {
    const { data } = await supabase.from('billing_snapshots').select('*').eq('entity_id', entityId).order('generated_at', { ascending: false }).limit(limit);
    return (data || []) as BillingSnapshot[];
  }
};
