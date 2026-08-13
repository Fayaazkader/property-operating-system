// lib/revenue/portfolio-revenue-builder.ts
// Builds portfolio-wide revenue context by aggregating per-entity contexts

import { supabase } from '@/lib/supabase';
import { buildRevenueContext } from './revenue-context-builder';
import type { RevenueContext, BillingTenant } from './types';

export interface PortfolioRevenueContext {
  entityContexts: Array<{
    entityId: string;
    stmtPeriodId: string;
    finPeriodId: string;
    worksheet: RevenueContext;
  }>;
  allTenants: BillingTenant[];
  totalExpected: number;
  entityCount: number;
}

export async function buildPortfolioRevenueContext(
  entityIds: string[]
): Promise<PortfolioRevenueContext> {
  const entityContexts: Array<{
    entityId: string;
    stmtPeriodId: string;
    finPeriodId: string;
    worksheet: RevenueContext;
  }> = [];

  for (const entityId of entityIds) {
    // Get this entity's open statement period
    const { data: stmtPeriod } = await supabase
      .from('financial_periods')
      .select('id')
      .eq('entity_id', entityId)
      .eq('period_type', 'statement')
      .eq('status', 'open')
      .order('period_start')
      .limit(1)
      .single();

    // Get this entity's open financial period
    const { data: finPeriod } = await supabase
      .from('financial_periods')
      .select('id')
      .eq('entity_id', entityId)
      .eq('period_type', 'financial')
      .eq('status', 'open')
      .order('period_start')
      .limit(1)
      .single();

    if (!stmtPeriod?.id || !finPeriod?.id) continue;

    const worksheet = await buildRevenueContext(
      entityId,
      null,
      stmtPeriod.id,
      finPeriod.id
    );

    entityContexts.push({
      entityId,
      stmtPeriodId: stmtPeriod.id,
      finPeriodId: finPeriod.id,
      worksheet,
    });
  }

  const allTenants = entityContexts.flatMap(ec => ec.worksheet.tenants);
  const totalExpected = allTenants.reduce((s, t) => s + t.total, 0);

  return {
    entityContexts,
    allTenants,
    totalExpected,
    entityCount: entityContexts.length,
  };
}
