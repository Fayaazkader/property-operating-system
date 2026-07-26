// lib/revenue/services/statement-service.ts
// Statement business logic. Never calls Supabase directly.

import { supabase } from '@/lib/supabase';
import { statementData } from '../data/statement-data';
import { configService } from './config-service';
import { chargePreviewService } from './charge-preview-service';

export interface StatementLine {
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  section: 'posted' | 'projected';
}

export interface ProjectedCharge {
  description: string;
  amount: number;
  source: string;
  category: string;
  status: 'projected_fixed' | 'projected_variable' | 'pending';
  confidence: string;
  billing_period: string;
}

export interface StatementResult {
  tenant_id: string;
  tenant_name: string;
  property_name: string;
  lease_ref: string;
  statement_date: string;
  opening_balance: number;
  closing_balance: number;
  posted_lines: StatementLine[];
  projected_charges?: ProjectedCharge[];
  deposit_held?: number;
  header_message?: string;
  footer_message?: string;
  version: number;
  status: string;
  generated_at: string;
  logo_url?: string;
  company_name?: string;
  company_address?: string;
  company_contact?: string;
  company_vat_number?: string;
}

export interface StatementOptions {
  includeBalanceBf?: boolean;
  includeDeposit?: boolean;
  includeProjected?: boolean;
  customHeader?: string;
  customFooter?: string;
  generatedBy?: string;
  reason?: string;
}

export const statementService = {
  async generate(entityId: string, tenantId: string, options: StatementOptions = {}): Promise<StatementResult> {
    // Get the latest clean data from statements_generated (saved during billing)
    const { data: latestStatement } = await supabase
      .from('statements_generated')
      .select('statement_data')
      .eq('entity_id', entityId)
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    const cleanData = latestStatement?.statement_data || {};

    const [invoiceConfig, statementConfig, tenantOverrides, tenant, lease] = await Promise.all([
      configService.getInvoiceConfig(entityId),
      configService.getStatementConfig(entityId),
      configService.getTenantOverrides(entityId, tenantId),
      statementData.getTenantInfo(tenantId),
      statementData.getActiveLease(tenantId),
    ]);

    const property = lease ? await statementData.getProperty(lease.property_id) : null;

    const overrideMap: Record<string, string> = {};
    for (const o of tenantOverrides) { overrideMap[o.setting_key] = o.setting_value; }

    const includeBalanceBf = options.includeBalanceBf ?? invoiceConfig?.show_balance_brought_forward ?? true;
    const includeDeposit = options.includeDeposit ?? invoiceConfig?.show_deposit_guarantee ?? true;
    const includeProjected = options.includeProjected ?? statementConfig?.show_next_period_charges ?? true;
    const headerMsg = options.customHeader || overrideMap['header_message'] || invoiceConfig?.header_message || '';
    const footerMsg = options.customFooter || overrideMap['footer_message'] || invoiceConfig?.footer_message || '';

    // Use clean posted_lines from statements_generated (saved during billing)
    const postedLines: StatementLine[] = (cleanData.posted_lines || []).map((l: any) => ({
      date: l.date || '',
      description: l.description || '',
      reference: l.reference || '',
      debit: l.debit || 0,
      credit: l.credit || 0,
      balance: l.balance || 0,
      section: 'posted' as const,
    }));
    const runningBalance = postedLines.length > 0 ? postedLines[postedLines.length - 1].balance : 0;

    // Projected charges
    let projectedCharges: ProjectedCharge[] | undefined;
    if (includeProjected && lease) {
      projectedCharges = await chargePreviewService.getUpcomingCharges(tenantId, lease.id);
    }

    const depositHeld = includeDeposit ? await statementData.getDepositHeld(tenantId) : undefined;
    const version = await statementData.getLatestVersion(entityId, tenantId);

    const result: StatementResult = {
      tenant_id: tenantId,
      tenant_name: tenant?.tenant_name || 'Unknown',
      property_name: property?.property_name || 'Unknown',
      lease_ref: lease?.lease_ref || 'N/A',
      statement_date: new Date().toISOString().split('T')[0],
      opening_balance: postedLines[0]?.balance || 0,
      closing_balance: runningBalance,
      posted_lines: postedLines,
      projected_charges: projectedCharges,
      deposit_held: depositHeld,
      header_message: headerMsg || undefined,
      footer_message: footerMsg || undefined,
      version,
      status: 'draft',
      generated_at: new Date().toISOString(),
      logo_url: (invoiceConfig as any)?.logo_url,
      company_name: (invoiceConfig as any)?.company_name,
      company_address: (invoiceConfig as any)?.company_address,
      company_contact: (invoiceConfig as any)?.company_contact,
      company_vat_number: (invoiceConfig as any)?.company_vat_number,
    };

    return result;
  },

  async getHistory(entityId: string, tenantId: string) {
    return statementData.getStatementHistory(entityId, tenantId);
  }
};
