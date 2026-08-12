// lib/revenue/billing-freeze.ts
// Billing Freeze — Creates authoritative financial records from worksheet

import { supabase } from '@/lib/supabase';
import { postingEngine } from '@/lib/financial/posting-engine';
import { logAudit } from '@/lib/audit/audit-log';

export interface FreezeResult {
  tenant_id: string;
  tenant_name: string;
  posted: boolean;
  invoice_id?: string;
  statement_id?: string;
  error?: string;
}

export async function freezeBilling(params: {
  entityId: string;
  periodId: string;
  periodName: string;
  periodStart: string;
  tenants: Array<{
    tenantId: string;
    tenantName: string;
    leaseId: string;
    property_name: string;
    charges: Array<{ source: string; description: string; amount: number; vatAmount: number; total: number; glCode?: string }>;
  }>;
}): Promise<{ results: FreezeResult[]; invoiceIds: string[] }> {
  const results: FreezeResult[] = [];
  const invoiceIds: string[] = [];

  for (const tenant of params.tenants) {
    try {
      // Check if already posted — idempotent
      const sourceId = `INV-${params.periodName}-${tenant.tenantId}`;
      const { data: existing } = await supabase
        .from('journals')
        .select('id')
        .eq('entity_id', params.entityId)
        .eq('source_event', 'rental_invoice_raised')
        .eq('source_id', sourceId)
        .limit(1);

      if (existing?.length) {
        // Already frozen — skip
        const { data: stmt } = await supabase
          .from('statements_generated')
          .select('id')
          .eq('entity_id', params.entityId)
          .eq('tenant_id', tenant.tenantId)
          .order('generated_at', { ascending: false })
          .limit(1)
          .single();

        results.push({
          tenant_id: tenant.tenantId,
          tenant_name: tenant.tenantName,
          posted: false,
          invoice_id: sourceId,
          statement_id: stmt?.id,
          error: 'Already frozen — skipped',
        });
        invoiceIds.push(sourceId);
        continue;
      }

      // Post each charge type separately for proper accounting
      for (const charge of tenant.charges) {
        if (charge.amount <= 0) continue;

        let businessEvent = 'rental_invoice_raised';
        if (charge.source === 'utility') businessEvent = 'recovery_invoice_raised';
        if (charge.source === 'manual') businessEvent = 'rental_invoice_raised';
        if (charge.source === 'escalation') businessEvent = 'rental_invoice_raised';

        await postingEngine.post({
          source_engine: 'revenue',
          business_event: businessEvent,
          entity_id: params.entityId,
          amount: charge.amount,
          period_id: params.periodId,
          occurred_at: new Date().toISOString(),
          effective_date: params.periodStart || new Date().toISOString().split('T')[0],
          dimensions: {
            tenant_id: tenant.tenantId,
            lease_id: tenant.leaseId,
          },
          metadata: {
            source_id: sourceId,
            charge_type: charge.source,
            description: charge.description,
            created_by: 'system',
          },
        });
      }

      // Create authoritative statement
      const { data: statement } = await supabase
        .from('statements_generated')
        .insert({
          entity_id: params.entityId,
          tenant_id: tenant.tenantId,
          statement_data: {
            tenant_name: tenant.tenantName,
            property_name: tenant.property_name || 'Unknown',
            statement_date: params.periodStart || params.periodName,
            charges: tenant.charges,
            closing_balance: tenant.charges.reduce((s, c) => s + c.total, 0),
            version: 1,
            status: 'issued',
            frozen: true,
            period_id: params.periodId,
            period_name: params.periodName,
            generated_at: new Date().toISOString(),
          },
          version: 1,
          status: 'issued',
          generated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      invoiceIds.push(sourceId);

      results.push({
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName,
        posted: true,
        invoice_id: sourceId,
        statement_id: statement?.id,
      });
    } catch (err: any) {
      results.push({
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName,
        posted: false,
        error: err.message,
      });
    }
  }

  return { results, invoiceIds };
}
