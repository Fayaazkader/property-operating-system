// lib/revenue/revenue-context-builder.ts
// Orchestrates revenue worksheet. Delegates to assemblers and engines.

import { supabase } from '@/lib/supabase';
import { subscribe } from '@/lib/platform/events/event-bus';
import { ensureSuccessfulQueries } from './query-utils';
import { assembleCharges } from './charge-assembler';
import { evaluateWarnings } from './warning-engine';
import type { BillingTenant, BillingDocument, RevenueContext } from './types';

// Event-driven cache — invalidates on any operational change
const cache = new Map<string, { data: RevenueContext; timestamp: number }>();
const CACHE_TTL = 60000;

// Invalidate cache on relevant events
const INVALIDATION_EVENTS = [
  'lease.activated', 'lease.updated',
  'billing.rule.updated', 'billing.rule.created',
  'charge.manual_added', 'charge.updated',
  'interest.approved', 'late_fee.approved',
  'document.uploaded', 'document.deleted',
  'period.statement.closed', 'period.statement.opened',
];

for (const event of INVALIDATION_EVENTS) {
  subscribe(event, () => cache.clear());
}

export async function buildRevenueContext(
  entityId: string, propertyId: string | null,
  statementPeriodId: string, financialPeriodId: string
): Promise<RevenueContext> {
  const cacheKey = `${entityId}:${propertyId}:${statementPeriodId}:${financialPeriodId}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

  const periodId = statementPeriodId || financialPeriodId;
  const { data: period, error: periodError } = await supabase
    .from('financial_periods').select('period_name, period_start, period_end')
    .eq('id', periodId).single();
  if (periodError) throw new Error(`Period lookup failed: ${periodError.message}`);
  if (!period) throw new Error('Period not found');

  let leaseQuery = supabase.from('leases')
    .select('id, tenant_id, lease_id, property_id, monthly_rental, escalation_percent, commencement_date, lease_start_date, tenants!inner(tenant_name), properties!inner(property_name)')
    .eq('lease_status', 'Active').not('tenant_id', 'is', null).not('property_id', 'is', null);
  if (propertyId) leaseQuery = leaseQuery.eq('property_id', propertyId);

  const { data: leaseList, error: leaseError } = await leaseQuery;
  if (leaseError) throw new Error(`Lease query failed: ${leaseError.message}`);
  if (!leaseList?.length) {
    const empty: RevenueContext = { entityId, periodName: period.period_name, periodStart: period.period_start, periodEnd: period.period_end, tenants: [], isAlreadyBilled: false, totalExpected: 0 };
    cache.set(cacheKey, { data: empty, timestamp: Date.now() });
    return empty;
  }

  const leaseIds = leaseList.map(l => l.id);
  const tenantIds = [...new Set(leaseList.map(l => l.tenant_id))];
  const propertyIds = [...new Set(leaseList.map(l => l.property_id))];

  const [rulesResult, manualsResult, interestResult, lateFeesResult, tenantDocsResult, propertyDocsResult, journalsResult] = await Promise.all([
    supabase.from('billing_rules').select('*').in('lease_id', leaseIds).eq('status', 'active'),
    supabase.from('manual_charges').select('*').in('tenant_id', tenantIds).eq('status', 'posted').eq('period', period.period_name),
    supabase.from('interest_charges').select('*').in('tenant_id', tenantIds).eq('status', 'draft'),
    supabase.from('late_fee_charges').select('*').in('tenant_id', tenantIds).eq('status', 'draft'),
    supabase.from('documents').select('file_name, file_url, tenant_id').in('tenant_id', tenantIds),
    supabase.from('documents').select('file_name, file_url, related_entity_id').eq('related_entity_type', 'property').in('related_entity_id', propertyIds),
    supabase.from('journals').select('id').eq('entity_id', entityId).eq('source_event', 'rental_invoice_raised').like('source_id', `%${period.period_name}%`).limit(1),
  ]);

  ensureSuccessfulQueries([rulesResult, manualsResult, interestResult, lateFeesResult, tenantDocsResult, propertyDocsResult]);

  // Pre-index everything into Maps for O(1) lookups
  const index = <T>(data: T[], key: string): Map<string, T[]> => {
    const map = new Map<string, T[]>();
    for (const item of data) {
      const k = (item as any)[key];
      const list = map.get(k) || [];
      list.push(item);
      map.set(k, list);
    }
    return map;
  };

  const rulesByLease = index(rulesResult.data || [], 'lease_id');
  const manualsByTenant = index(manualsResult.data || [], 'tenant_id');
  const interestByTenant = index(interestResult.data || [], 'tenant_id');
  const lateFeesByTenant = index(lateFeesResult.data || [], 'tenant_id');
  const tenantDocsByTenant = index(tenantDocsResult.data || [], 'tenant_id');
  const propertyDocsByProperty = index(propertyDocsResult.data || [], 'related_entity_id');

  const tenants: BillingTenant[] = [];
  for (const lease of leaseList) {
    const { charges, hasEscalation, hasInterest, hasLateFee } = assembleCharges(
      rulesByLease.get(lease.id) || [],
      manualsByTenant.get(lease.tenant_id) || [],
      interestByTenant.get(lease.tenant_id) || [],
      lateFeesByTenant.get(lease.tenant_id) || [],
      lease, period.period_start, period.period_end
    );

    const warnings = evaluateWarnings({ chargesCount: charges.length, hasEscalation, hasInterest, hasLateFee });
    
    // Pre-indexed document lookup — no per-lease filter scans
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
      leaseId: lease.id, leaseRef: lease.lease_id,
      charges, documents: docs, warnings, total, ready: warnings.length === 0,
    });
  }

  const ctx: RevenueContext = {
    entityId, periodName: period.period_name, periodStart: period.period_start, periodEnd: period.period_end,
    tenants, isAlreadyBilled: (journalsResult.data || []).length > 0,
    totalExpected: tenants.reduce((s, t) => s + t.total, 0),
  };

  cache.set(cacheKey, { data: ctx, timestamp: Date.now() });
  return ctx;
}
