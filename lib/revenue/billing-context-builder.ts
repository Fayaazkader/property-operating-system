// lib/revenue/billing-context-builder.ts
// Builds complete billing context for a period. UI just displays.

import { supabase } from '@/lib/supabase';

export interface BillingCharge {
  type: string;
  description: string;
  amount: number;
  vatAmount: number;
  total: number;
  source: string;
  status: string;
  glCode?: string;
}

export interface BillingDocument {
  name: string;
  level: string;
  url: string;
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

export interface BillingContext {
  entityId: string;
  periodName: string;
  periodStart: string;
  periodEnd: string;
  tenants: BillingTenant[];
  isAlreadyBilled: boolean;
  totalExpected: number;
}

function isRuleDueForPeriod(rule: any, periodStart: string, periodEnd: string): boolean {
  if (!rule.effective_from) return true;
  const effectiveFrom = new Date(rule.effective_from);
  const effectiveTo = rule.effective_to ? new Date(rule.effective_to) : null;
  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);
  if (effectiveFrom > pEnd) return false;
  if (effectiveTo && effectiveTo < pStart) return false;
  return true;
}

export async function buildBillingContext(
  entityId: string,
  propertyId: string | null,
  statementPeriodId: string,
  financialPeriodId: string
): Promise<BillingContext> {
  // 1. Get the period
  const periodId = statementPeriodId || financialPeriodId;
  const { data: period, error: periodError } = await supabase
    .from('financial_periods')
    .select('period_name, period_start, period_end')
    .eq('id', periodId)
    .single();

  if (periodError) throw new Error(`Period lookup failed: ${periodError.message}`);
  if (!period) throw new Error('Period not found');

  // 2. Get all active leases with tenant and property names
  let leaseQuery = supabase
    .from('leases')
    .select('id, tenant_id, lease_id, property_id, monthly_rental, escalation_percent, commencement_date, lease_start_date, tenants!inner(tenant_name), properties!inner(property_name)')
    .eq('lease_status', 'Active')
    .not('tenant_id', 'is', null)
    .not('property_id', 'is', null);

  if (propertyId) leaseQuery = leaseQuery.eq('property_id', propertyId);

  const { data: leaseList, error: leaseError } = await leaseQuery;
  if (leaseError) throw new Error(`Lease query failed: ${leaseError.message}`);
  if (!leaseList?.length) return { entityId, periodName: period.period_name, periodStart: period.period_start, periodEnd: period.period_end, tenants: [], isAlreadyBilled: false, totalExpected: 0 };

  const leaseIds = leaseList.map(l => l.id);
  const tenantIds = [...new Set(leaseList.map(l => l.tenant_id))];
  const propertyIds = [...new Set(leaseList.map(l => l.property_id))];

  // 3. Fetch all data in parallel
  const [
    rulesResult, manualsResult, interestResult, lateFeesResult,
    tenantDocsResult, propertyDocsResult, journalsResult,
  ] = await Promise.all([
    supabase.from('billing_rules').select('*').in('lease_id', leaseIds).eq('status', 'active'),
    supabase.from('manual_charges').select('*').in('tenant_id', tenantIds).eq('status', 'posted').eq('period', period.period_name),
    supabase.from('interest_charges').select('*').in('tenant_id', tenantIds).eq('status', 'draft'),
    supabase.from('late_fee_charges').select('*').in('tenant_id', tenantIds).eq('status', 'draft'),
    supabase.from('documents').select('file_name, file_url, tenant_id').in('tenant_id', tenantIds),
    supabase.from('documents').select('file_name, file_url, related_entity_id').eq('related_entity_type', 'property').in('related_entity_id', propertyIds),
    supabase.from('journals').select('id').eq('entity_id', entityId).eq('source_event', 'rental_invoice_raised').like('source_id', `%${period.period_name}%`).limit(1),
  ]);

  // Check errors
  if (rulesResult.error) throw new Error(`Rules query failed: ${rulesResult.error.message}`);
  if (manualsResult.error) throw new Error(`Manuals query failed: ${manualsResult.error.message}`);
  if (interestResult.error) throw new Error(`Interest query failed: ${interestResult.error.message}`);
  if (lateFeesResult.error) throw new Error(`Late fees query failed: ${lateFeesResult.error.message}`);
  if (tenantDocsResult.error) throw new Error(`Tenant docs query failed: ${tenantDocsResult.error.message}`);
  if (propertyDocsResult.error) throw new Error(`Property docs query failed: ${propertyDocsResult.error.message}`);

  // 4. Index everything by key for O(1) lookup
  const rulesByLease = new Map<string, any[]>();
  for (const r of (rulesResult.data || [])) {
    const list = rulesByLease.get(r.lease_id) || [];
    list.push(r);
    rulesByLease.set(r.lease_id, list);
  }

  const manualsByTenant = new Map<string, any[]>();
  for (const m of (manualsResult.data || [])) {
    const list = manualsByTenant.get(m.tenant_id) || [];
    list.push(m);
    manualsByTenant.set(m.tenant_id, list);
  }

  const interestByTenant = new Map<string, any[]>();
  for (const i of (interestResult.data || [])) {
    const list = interestByTenant.get(i.tenant_id) || [];
    list.push(i);
    interestByTenant.set(i.tenant_id, list);
  }

  const lateFeesByTenant = new Map<string, any[]>();
  for (const lf of (lateFeesResult.data || [])) {
    const list = lateFeesByTenant.get(lf.tenant_id) || [];
    list.push(lf);
    lateFeesByTenant.set(lf.tenant_id, list);
  }

  const tenantDocsByTenant = new Map<string, any[]>();
  for (const d of (tenantDocsResult.data || [])) {
    const list = tenantDocsByTenant.get(d.tenant_id) || [];
    list.push(d);
    tenantDocsByTenant.set(d.tenant_id, list);
  }

  const propertyDocsByProperty = new Map<string, any[]>();
  for (const d of (propertyDocsResult.data || [])) {
    const list = propertyDocsByProperty.get(d.related_entity_id) || [];
    list.push(d);
    propertyDocsByProperty.set(d.related_entity_id, list);
  }

  // 5. Build tenant list with O(1) lookups
  const tenants: BillingTenant[] = [];

  for (const lease of leaseList) {
    const charges: BillingCharge[] = [];
    const warnings: string[] = [];

    const rules = rulesByLease.get(lease.id) || [];
    for (const r of rules) {
      if (!isRuleDueForPeriod(r, period.period_start, period.period_end)) continue;
      const vat = Math.round(r.base_amount * (r.vat_rate / 100) * 100) / 100;
      charges.push({
        type: r.rule_type, description: r.description, amount: r.base_amount,
        vatAmount: vat, total: r.base_amount + vat, source: 'lease',
        status: 'posted', glCode: r.gl_code,
      });
    }

    const manuals = manualsByTenant.get(lease.tenant_id) || [];
    for (const m of manuals) {
      const vat = Math.round(m.amount * ((m.vat_rate || 15) / 100) * 100) / 100;
      charges.push({
        type: 'manual', description: m.description, amount: m.amount,
        vatAmount: vat, total: m.amount + vat, source: 'manual',
        status: 'posted', glCode: m.gl_code,
      });
    }

    for (const inv of (interestByTenant.get(lease.tenant_id) || [])) {
      charges.push({
        type: 'interest', description: `Interest — ${inv.description || 'Late Payment'}`,
        amount: inv.amount, vatAmount: 0, total: inv.amount, source: 'interest', status: 'suggested',
      });
      warnings.push('Interest charge pending approval');
    }

    for (const lf of (lateFeesByTenant.get(lease.tenant_id) || [])) {
      charges.push({
        type: 'late_fee', description: `Late Fee — ${lf.description || 'Overdue'}`,
        amount: lf.amount, vatAmount: 0, total: lf.amount, source: 'late_fee', status: 'suggested',
      });
      warnings.push('Late fee pending approval');
    }

    // Escalation check
    if (lease.escalation_percent && lease.escalation_percent > 0) {
      const effectiveDate = new Date(lease.commencement_date || lease.lease_start_date);
      const periodDate = new Date(period.period_start);
      const monthsSinceStart = (periodDate.getFullYear() - effectiveDate.getFullYear()) * 12 + (periodDate.getMonth() - effectiveDate.getMonth());
      if (monthsSinceStart > 0 && monthsSinceStart % 12 === 0) {
        const yearsOfEscalation = Math.floor(monthsSinceStart / 12);
        const factor = Math.pow(1 + lease.escalation_percent / 100, yearsOfEscalation);
        const prevFactor = Math.pow(1 + lease.escalation_percent / 100, yearsOfEscalation - 1);
        const increase = Math.round(lease.monthly_rental * (factor - prevFactor) * 100) / 100;
        const vat = Math.round(increase * 0.15 * 100) / 100;
        charges.push({
          type: 'escalation', description: `Annual Escalation (${lease.escalation_percent}%)`,
          amount: increase, vatAmount: vat, total: increase + vat, source: 'escalation', status: 'suggested',
        });
        warnings.push('Escalation applied — review rental amount');
      }
    }

    if (charges.length === 0) warnings.push('No billing rules for this period');

    const docs: BillingDocument[] = [];
    for (const d of (tenantDocsByTenant.get(lease.tenant_id) || []).slice(0, 3)) {
      docs.push({ name: d.file_name, level: 'tenant', url: d.file_url, type: 'tenant_document' });
    }
    for (const d of (propertyDocsByProperty.get(lease.property_id) || []).slice(0, 3)) {
      docs.push({ name: d.file_name, level: 'property', url: d.file_url, type: 'property_document' });
    }

    const total = charges.reduce((s, c) => s + c.total, 0);
    tenants.push({
      tenantId: lease.tenant_id,
      tenantName: (lease as any).tenants?.tenant_name || 'Unknown',
      property_name: (lease as any).properties?.property_name || 'Unknown',
      leaseId: lease.id,
      leaseRef: lease.lease_id,
      charges, documents: docs, warnings,
      total, ready: warnings.length === 0,
    });
  }

  const isAlreadyBilled = (journalsResult.data || []).length > 0;

  return {
    entityId,
    periodName: period.period_name,
    periodStart: period.period_start,
    periodEnd: period.period_end,
    tenants,
    isAlreadyBilled,
    totalExpected: tenants.reduce((s, t) => s + t.total, 0),
  };
}
