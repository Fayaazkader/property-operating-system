// lib/revenue/portfolio-revenue-builder.ts
// Builds portfolio-wide revenue context by aggregating per-entity contexts

import { supabase } from '@/lib/supabase';
import { buildRevenueContext } from './revenue-context-builder';
import type { RevenueContext, BillingTenant } from './types';

export interface PortfolioEntityContext {
  entityId: string;
  stmtPeriodId: string;
  finPeriodId: string;
  statementStatus: string;
  financialStatus: string;
  worksheet: RevenueContext;
}

export interface PortfolioRevenueContext {
  entityContexts: PortfolioEntityContext[];
  allTenants: BillingTenant[];
  totalExpected: number;
  entityCount: number;
  errors: Array<{ entityId: string; reason: string }>;
}

export async function buildPortfolioRevenueContext(
  entityIds: string[]
): Promise<PortfolioRevenueContext> {
  const entityContexts: PortfolioEntityContext[] = [];
  const errors: Array<{ entityId: string; reason: string }> = [];

  for (const entityId of entityIds) {
    // Get statement period with status
    const { data: stmtPeriod } = await supabase
      .from('financial_periods')
      .select('id, status')
      .eq('entity_id', entityId)
      .eq('period_type', 'statement')
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    // Get financial period with status
    const { data: finPeriod } = await supabase
      .from('financial_periods')
      .select('id, status')
      .eq('entity_id', entityId)
      .eq('period_type', 'financial')
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (!stmtPeriod?.id) {
      errors.push({ entityId, reason: 'missing_statement_period' });
      continue;
    }

    if (!finPeriod?.id) {
      errors.push({ entityId, reason: 'missing_financial_period' });
      continue;
    }

    try {
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
        statementStatus: stmtPeriod.status,
        financialStatus: finPeriod.status,
        worksheet,
      });
    } catch (err: any) {
      errors.push({ entityId, reason: err.message || 'worksheet_build_failed' });
    }
  }

  const allTenants = entityContexts.flatMap(ec => ec.worksheet.tenants);
  const totalExpected = allTenants.reduce((s, t) => s + t.total, 0);

  return { entityContexts, allTenants, totalExpected, entityCount: entityContexts.length, errors };
}
