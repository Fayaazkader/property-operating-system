// lib/revenue/revenue-context-builder.ts
// Orchestrates revenue worksheet. Delegates to assemblers and engines.

import { supabase } from '@/lib/supabase';
import { ensureSuccessfulQueries } from './query-utils';
import { assembleCharges } from './charge-assembler';
import { evaluateWarnings } from './warning-engine';
import { assembleDocuments } from './document-assembler';
import type { BillingTenant, BillingDocument, RevenueContext } from './types';

import { RevenueCache } from './revenue-cache';

export async function buildRevenueContext(
  entityId: string, propertyId: string | null,
  statementPeriodId: string, financialPeriodId: string
): Promise<RevenueContext> {
  const cached = RevenueCache.get(entityId, propertyId, statementPeriodId, financialPeriodId);
  if (cached) return cached;

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
    RevenueCache.set(entityId, propertyId, statementPeriodId, financialPeriodId, empty);
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
    supabase.from('documents').select('file_name, storage_key, tenant_id').in('tenant_id', tenantIds),
    supabase.from('documents').select('file_name, storage_key, related_entity_id').eq('related_entity_type', 'property').in('related_entity_id', propertyIds),
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
    
    const docs = assembleDocuments(
      tenantDocsByTenant.get(lease.tenant_id) || [],
      propertyDocsByProperty.get(lease.property_id) || [],
      lease.tenant_id,
      lease.property_id
    );

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

  RevenueCache.set(entityId, propertyId, statementPeriodId, financialPeriodId, ctx);
  return ctx;
}
