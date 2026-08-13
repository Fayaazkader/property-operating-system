// lib/revenue/historical-impact.ts
// Historical Billing Impact Detection
// Compares frozen billing state against recalculation — never rewrites history

import { supabase } from '@/lib/supabase';
import { buildRevenueContext } from './revenue-context-builder';

export interface AffectedPeriod {
  period_id: string;
  period_name: string;
  frozen_amount: number;
  recalculated_amount: number;
  difference: number;
  frozen_components: Record<string, number>;
  recalculated_components: Record<string, number>;
}

export interface HistoricalImpact {
  lease_id: string;
  tenant_name: string;
  effective_date: string;
  affected_periods: AffectedPeriod[];
  total_difference: number;
}

export class HistoricalImpactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HistoricalImpactError';
  }
}

export async function detectHistoricalImpact(
  leaseId: string,
  newEffectiveDate: string
): Promise<HistoricalImpact | null> {
  // Get lease info
  const { data: lease } = await supabase
    .from('leases')
    .select('id, tenant_id, tenant:tenant_id(tenant_name), owner_entity_id')
    .eq('id', leaseId)
    .single();

  if (!lease) throw new HistoricalImpactError('Lease not found');

  // Find frozen/closed statement periods that fall ON or AFTER the new effective date
  const { data: frozenPeriods } = await supabase
    .from('financial_periods')
    .select('id, period_name, period_start, period_end, status')
    .eq('entity_id', lease.owner_entity_id)
    .eq('period_type', 'statement')
    .in('status', ['closed', 'frozen'])
    .gte('period_start', newEffectiveDate)
    .order('period_start');

  if (!frozenPeriods?.length) return null;

  const affectedPeriods: AffectedPeriod[] = [];

  for (const period of frozenPeriods) {
    // Get the FROZEN authoritative invoice for this lease+period
    const { data: frozenStatement } = await supabase
      .from('statements_generated')
      .select('statement_data')
      .eq('entity_id', lease.owner_entity_id)
      .eq('tenant_id', lease.tenant_id)
      .eq('status', 'issued')
      .eq('statement_data->>period_name', period.period_name)
      .single();

    if (!frozenStatement) continue;

    const frozenData = frozenStatement.statement_data;
    const frozenTotal = frozenData.closing_balance || 0;
    const frozenComponents = extractComponents(frozenData.charges || []);

    // RECALCULATE what the current rules would produce for this period
    // This uses the same billing engine but with the new lease values
    const recalculated = await recalculateForPeriod(lease, period);
    if (!recalculated) continue;

    const difference = recalculated.total - frozenTotal;

    // Only flag if there's a material difference
    if (Math.abs(difference) < 0.01) continue;

    affectedPeriods.push({
      period_id: period.id,
      period_name: period.period_name,
      frozen_amount: frozenTotal,
      recalculated_amount: recalculated.total,
      difference,
      frozen_components: frozenComponents,
      recalculated_components: recalculated.components,
    });
  }

  if (affectedPeriods.length === 0) return null;

  return {
    lease_id: leaseId,
    tenant_name: (lease as any).tenant?.tenant_name || 'Unknown',
    effective_date: newEffectiveDate,
    affected_periods: affectedPeriods,
    total_difference: affectedPeriods.reduce((s, p) => s + p.difference, 0),
  };
}

function extractComponents(charges: any[]): Record<string, number> {
  const components: Record<string, number> = {};
  for (const c of charges) {
    components[c.description || c.type || 'charge'] = c.total || c.amount || 0;
  }
  return components;
}

async function recalculateForPeriod(lease: any, period: any): Promise<{ total: number; components: Record<string, number> } | null> {
  try {
    // Use the SAME billing engine that produces invoices
    const worksheet = await buildRevenueContext(
      lease.owner_entity_id,
      null,
      period.id,
      period.id
    );

    const tenantWorksheet = worksheet.tenants.find((t: any) => t.tenantId === lease.tenant_id);
    if (!tenantWorksheet) return null;

    const components: Record<string, number> = {};
    for (const c of tenantWorksheet.charges) {
      components[c.description || c.type || 'charge'] = c.total || c.amount || 0;
    }

    return {
      total: tenantWorksheet.total,
      components,
    };
  } catch {
    return null;
  }
}
