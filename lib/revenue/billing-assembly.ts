// lib/revenue/billing-assembly.ts
// Billing Assembly — Assembles worksheet for a specific statement period

import { supabase } from '@/lib/supabase';

export interface BillingCharge {
  type: string;
  description: string;
  amount: number;
  vatAmount: number;
  total: number;
  source: 'lease' | 'manual' | 'utility' | 'interest' | 'late_fee' | 'credit_note' | 'escalation';
  status: 'posted' | 'suggested' | 'draft';
  glCode?: string;
}

export interface BillingDocument {
  name: string;
  level: 'tenant' | 'property' | 'entity';
  url?: string;
  type: string;
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
  status: 'ready' | 'already_billed' | 'period_closed' | 'no_active_leases' | 'no_open_period';
  blockingReason?: string;
}

export interface BillingSnapshot {
  id: string;
  period: string;
  property_name: string;
  tenant_count: number;
  invoices_generated: number;
  statements_generated: number;
  emails_delivered: number;
  whatsapp_delivered: number;
  failed: number;
    invoice_ids?: string[];
  generated_at: string;
}

function isRuleDueForPeriod(rule: any, periodStart: string, periodEnd: string): boolean {
  if (!rule.effective_from) return true;
  if (rule.effective_from > periodEnd) return false;
  
  const frequency = rule.frequency || 'monthly';
  if (frequency === 'monthly') return true;
  
  // For non-monthly frequencies, check if this period aligns
  const effectiveDate = new Date(rule.effective_from);
  const periodStartDate = new Date(periodStart);
  
  if (frequency === 'quarterly') {
    const monthsDiff = (periodStartDate.getFullYear() - effectiveDate.getFullYear()) * 12 + 
                       (periodStartDate.getMonth() - effectiveDate.getMonth());
    return monthsDiff % 3 === 0;
  }
  
  if (frequency === 'annually') {
    return periodStartDate.getMonth() === effectiveDate.getMonth();
  }
  
  return true;
}

export const billingAssembly = {
  async assembleWorksheet(entityId: string, propertyId: string | null, periodId: string): Promise<BillingWorksheet> {
        // Resolve VAT rate from entity tax configuration
    const { data: taxConfig } = await supabase
      .from('tax_config')
      .select('tax_rate')
      .eq('entity_id', entityId)
      .eq('tax_code', 'VAT_STANDARD')
      .single();
    const vatRate = taxConfig?.tax_rate ?? 0;
    // Validate period is open
    const { data: period } = await supabase.from('financial_periods')
      .select('id, period_name, status, period_start, period_end')
      .eq('id', periodId)
      .eq('period_type', 'statement')
      .single();

    if (!period) {
      return { property_name: '', tenants: [], totalCharges: 0, readyCount: 0, warningCount: 0, status: 'no_open_period', blockingReason: 'No statement period found' };
    }

    if (period.status !== 'open') {
      return { property_name: '', tenants: [], totalCharges: 0, readyCount: 0, warningCount: 0, status: 'period_closed', blockingReason: `Period ${period.period_name} is ${period.status}` };
    }


    // Fetch active leases
    let query = supabase.from('leases')
      .select('id, tenant_id, lease_id, property_id, monthly_rental, escalation_percent, commencement_date, lease_start_date, tenants!inner(tenant_name), properties!inner(property_name)')
      .eq('lease_status', 'Active')
      .eq('owner_entity_id', entityId);
    if (propertyId) query = query.eq('property_id', propertyId);
    
    const { data: leaseList } = await query;

    if (!leaseList?.length) {
      return { property_name: '', tenants: [], totalCharges: 0, readyCount: 0, warningCount: 0, status: 'no_active_leases', blockingReason: 'No active leases found' };
    }

    const propertyName = (leaseList[0] as any).properties?.property_name || (leaseList[0] as any).property_name || 'Unknown';
    const tenants: BillingTenant[] = [];
    const periodStart = period.period_start;
    const periodEnd = period.period_end;

    for (const lease of leaseList) {
      const charges: BillingCharge[] = [];
      const warnings: string[] = [];

      // 1. Lease billing rules — filtered by period
      const { data: rules } = await supabase.from('billing_rules')
        .select('*')
        .eq('lease_id', lease.id)
        .eq('status', 'active');

      for (const r of (rules || [])) {
        if (!isRuleDueForPeriod(r, periodStart, periodEnd)) continue;
        const vat = Math.round(r.base_amount * (r.vat_rate / 100) * 100) / 100;
        charges.push({
          type: r.rule_type, description: r.description, amount: r.base_amount,
          vatAmount: vat, total: r.base_amount + vat, source: 'lease',
          status: 'posted', glCode: r.gl_code,
        });
      }

      // 2. Manual charges — filtered by period
      const { data: manuals } = await supabase.from('manual_charges')
        .select('*')
        .eq('tenant_id', lease.tenant_id)
        .eq('status', 'posted')
        .eq('period', period.period_name);

      for (const m of (manuals || [])) {
        const vat = Math.round(m.amount * ((m.vat_rate || 15) / 100) * 100) / 100;
        charges.push({
          type: 'manual', description: m.description, amount: m.amount,
          vatAmount: vat, total: m.amount + vat, source: 'manual',
          status: 'posted', glCode: m.gl_code,
        });
      }

      // 3. Interest suggestions (draft)
      const { data: interestSuggestions } = await supabase.from('interest_charges')
        .select('*')
        .eq('tenant_id', lease.tenant_id)
        .eq('status', 'draft');

      for (const inv of (interestSuggestions || [])) {
        charges.push({
          type: 'interest', description: `Interest — ${inv.description || 'Late Payment'}`,
          amount: inv.amount, vatAmount: 0, total: inv.amount, source: 'interest',
          status: 'suggested',
        });
        warnings.push('Interest charge pending approval');
      }

      // 4. Late fee suggestions (draft)
      const { data: lateFeeSuggestions } = await supabase.from('late_fee_charges')
        .select('*')
        .eq('tenant_id', lease.tenant_id)
        .eq('status', 'draft');

      for (const lf of (lateFeeSuggestions || [])) {
        charges.push({
          type: 'late_fee', description: `Late Fee — ${lf.description || 'Overdue'}`,
          amount: lf.amount, vatAmount: 0, total: lf.amount, source: 'late_fee',
          status: 'suggested',
        });
        warnings.push('Late fee pending approval');
      }

      // 5. Escalations — check if escalation is due this period
      if (lease.escalation_percent && lease.escalation_percent > 0) {
        const effectiveDate = new Date(lease.commencement_date || lease.lease_start_date);
        const periodDate = new Date(periodStart);
        const monthsSinceStart = (periodDate.getFullYear() - effectiveDate.getFullYear()) * 12 + 
                                  (periodDate.getMonth() - effectiveDate.getMonth());
        
        if (monthsSinceStart > 0 && monthsSinceStart % 12 === 0) {
  const yearsOfEscalation = Math.floor(monthsSinceStart / 12);
  const escalationFactor = Math.pow(1 + lease.escalation_percent / 100, yearsOfEscalation);
  const escalatedRent = Math.round(lease.monthly_rental * escalationFactor * 100) / 100;
  const previousEscalationFactor = Math.pow(1 + lease.escalation_percent / 100, yearsOfEscalation - 1);
  const previousRent = Math.round(lease.monthly_rental * previousEscalationFactor * 100) / 100;
  const increase = escalatedRent - previousRent;
                   const vat = Math.round(increase * (vatRate / 100) * 100) / 100;
          charges.push({
            type: 'escalation', description: `Annual Escalation (${lease.escalation_percent}%)`,
            amount: increase, vatAmount: vat, total: increase + vat, source: 'escalation',
            status: 'suggested',
          });
          warnings.push('Escalation applied — review rental amount');
        }
      }

      if (charges.length === 0) warnings.push('No billing rules for this period');

      // Documents
      const docs: BillingDocument[] = [];
      const { data: tenantDocs } = await supabase.from('documents')
        .select('file_name, file_url').eq('tenant_id', lease.tenant_id).limit(3);
      (tenantDocs || []).forEach(d => docs.push({ name: d.file_name, level: 'tenant', url: d.file_url, type: 'tenant_document' }));

      const { data: propertyDocs } = await supabase.from('documents')
        .select('file_name, file_url')
        .eq('related_entity_type', 'property')
        .eq('related_entity_id', lease.property_id).limit(3);
      (propertyDocs || []).forEach(d => docs.push({ name: d.file_name, level: 'property', url: d.file_url, type: 'property_document' }));

      const total = charges.reduce((s, c) => s + c.total, 0);
      tenants.push({
        tenantId: lease.tenant_id, tenantName: (lease as any).tenants?.tenant_name || (lease as any).tenant_name || "Unknown",
        property_name: (lease as any).properties?.property_name || (lease as any).property_name || 'Unknown', leaseId: lease.id,
        leaseRef: lease.lease_id, charges, documents: docs, warnings,
        total, ready: warnings.length === 0,
      });
    }

        // Check if already billed
    const { data: existingJournals } = await supabase.from('journals')
      .select('id').eq('entity_id', entityId)
      .eq('source_event', 'rental_invoice_raised')
      .like('source_id', `%${period.period_name}%`).limit(1);

    const isAlreadyBilled = existingJournals && existingJournals.length > 0;

    return {
      property_name: propertyName, tenants,
      totalCharges: tenants.reduce((s, t) => s + t.total, 0),
      readyCount: tenants.filter(t => t.ready).length,
      warningCount: tenants.filter(t => !t.ready).length,
      status: isAlreadyBilled ? 'already_billed' : 'ready',
      blockingReason: isAlreadyBilled ? 'Invoices already exist for this period. Resend to regenerate.' : undefined,
    };
  },

  async saveSnapshot(params: {
     entity_id: string; period: string; property_id: string | null; property_name: string;
    tenant_count: number; invoices_generated: number; statements_generated: number;
    emails_delivered: number; whatsapp_delivered: number; failed: number;
    invoice_ids?: string[];
  }): Promise<void> {
    await supabase.from('billing_snapshots').insert({
      entity_id: params.entity_id, period: params.period,
      property_id: params.property_id, property_name: params.property_name,
      tenant_count: params.tenant_count, invoices_generated: params.invoices_generated,
      statements_generated: params.statements_generated,
      emails_delivered: params.emails_delivered,
      whatsapp_delivered: params.whatsapp_delivered, failed: params.failed,
      invoice_ids: params.invoice_ids || null,
      generated_at: new Date().toISOString(),
    });
  },

  async getSnapshots(entityId: string): Promise<BillingSnapshot[]> {
    const { data } = await supabase.from('billing_snapshots')
      .select('*').eq('entity_id', entityId)
      .order('generated_at', { ascending: false }).limit(20);
    return (data || []) as BillingSnapshot[];
  }
};
