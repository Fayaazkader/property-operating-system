// lib/revenue/billing-context-builder.ts
// Orchestrates billing context. Delegates to assemblers and engines.

import { supabase } from '@/lib/supabase';
import { ensureSuccessfulQueries } from './query-utils';
import { assembleCharges } from './charge-assembler';
import { assembleDocuments } from './document-assembler';
import { evaluateWarnings } from './warning-engine';
import type { BillingTenant, BillingCharge, BillingDocument, RevenueContext } from './types';

export interface RevenueContext {
  entityId: string; periodName: string; periodStart: string; periodEnd: string;
  tenants: BillingTenant[]; isAlreadyBilled: boolean; totalExpected: number;
}

// Simple in-memory cache
const cache = new Map<string, { data: RevenueContext; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

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

  // Index into Maps for O(1)
  const index = <T>(data: T[], key: string) => {
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
    const docs = assembleDocuments(tenantDocsResult.data || [], propertyDocsResult.data || [], lease.tenant_id, lease.property_id);
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
