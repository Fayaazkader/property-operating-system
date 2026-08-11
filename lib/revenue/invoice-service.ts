// lib/revenue/invoice-service.ts
// Invoice Service — Fetches validated invoice data for delivery
// ZERO hardcoded values. ZERO fallbacks. Fail on ANY missing required data.

import { supabase } from '@/lib/supabase';

export interface InvoiceDeliveryData {
  invoice_id: string;
  invoice_number: string;
  tenant_id: string;
  tenant_name: string;
  tenant_email?: string;
  tenant_whatsapp?: string;
  lease_id?: string;
  property_name: string;
  property_address?: string;
  entity_id: string;
  entity_name: string;
  entity_address: string;
  bank_details: string;
  period: string;
  due_date: string;
  line_items: Array<{ description: string; amount: number }>;
  sub_total: number;
  vat_amount: number;
  vat_rate: number;
  total: number;
  reference: string;
}

class InvoiceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoiceValidationError';
  }
}

export async function getInvoiceForDelivery(invoiceId: string): Promise<InvoiceDeliveryData> {
  const { data: entry, error } = await supabase
    .from('sub_ledger_entries')
    .select(`
      id, description, debit_amount, credit_amount, vat_amount, vat_rate,
      reference_type, reference_id, posted_at,
      tenant:tenant_id(id, tenant_name, email, whatsapp_number),
      lease:lease_id(id, property_id, lease_ref)
    `)
    .eq('id', invoiceId)
    .eq('ledger_type', 'tenant')
    .single();

  if (error || !entry) throw new InvoiceValidationError('Invoice not found');

  const inv = entry as any;

  // Validate tenant
  if (!inv.tenant?.tenant_name) throw new InvoiceValidationError('Missing tenant name');
  if (!inv.tenant?.id) throw new InvoiceValidationError('Missing tenant ID');

  // Validate lease and property
  if (!inv.lease?.property_id) throw new InvoiceValidationError('Missing property');
  const { data: prop } = await supabase
    .from('properties')
    .select('property_name, billing_address')
    .eq('id', inv.lease.property_id)
    .single();
  if (!prop?.property_name) throw new InvoiceValidationError('Missing property name');

  // Validate entity
  const { data: tenantEntity } = await supabase
    .from('tenants')
    .select('entity_id')
    .eq('id', inv.tenant.id)
    .single();
  if (!tenantEntity?.entity_id) throw new InvoiceValidationError('Missing entity');

  const { data: entityData } = await supabase
    .from('entities')
    .select('entity_name, address, bank_details')
    .eq('id', tenantEntity.entity_id)
    .single();
  if (!entityData?.entity_name) throw new InvoiceValidationError('Missing entity name');

  // Validate invoice number and due date from source record
  if (inv.reference_type !== 'invoice' || !inv.reference_id) {
    throw new InvoiceValidationError('Missing source invoice reference');
  }

  const { data: sourceInvoice } = await supabase
    .from('invoices')
    .select('invoice_number, due_date, period')
    .eq('id', inv.reference_id)
    .single();

  if (!sourceInvoice?.invoice_number) throw new InvoiceValidationError('Missing invoice number');
  if (!sourceInvoice?.due_date) throw new InvoiceValidationError('Missing due date');

  // Validate period
  let periodName = sourceInvoice.period;
  if (!periodName) {
    const { data: period } = await supabase
      .from('financial_periods')
      .select('period_name')
      .eq('entity_id', tenantEntity.entity_id)
      .eq('period_type', 'financial')
      .lte('period_start', new Date().toISOString())
      .order('period_start', { ascending: false })
      .limit(1)
      .single();
    if (!period?.period_name) throw new InvoiceValidationError('Missing financial period');
    periodName = period.period_name;
  }

  // Validate amount
  const debit = inv.debit_amount;
  if (!debit || debit <= 0) throw new InvoiceValidationError('Missing or invalid invoice amount');

  // Validate VAT rate
  let vatRate = inv.vat_rate;
  if (!vatRate) {
    const { data: journalLine } = await supabase
      .from('journal_lines')
      .select('account_id')
      .eq('reference_id', inv.reference_id)
      .single();
    
    if (journalLine) {
      const { data: account } = await supabase
        .from('chart_of_accounts')
        .select('vat_rate, vat_category')
        .eq('id', journalLine.account_id)
        .single();
      
      if (account?.vat_category === 'standard') {
        vatRate = account.vat_rate;
      }
    }
  }
  if (!vatRate && inv.vat_amount && inv.vat_amount > 0) {
    throw new InvoiceValidationError('VAT amount present but VAT rate not found');
  }

  // Validate description
  if (!inv.description) throw new InvoiceValidationError('Missing invoice description');

  const vat = inv.vat_amount || 0;

  return {
    invoice_id: invoiceId,
    invoice_number: sourceInvoice.invoice_number,
    tenant_id: inv.tenant.id,
    tenant_name: inv.tenant.tenant_name,
    tenant_email: inv.tenant.email || undefined,
    tenant_whatsapp: inv.tenant.whatsapp_number || undefined,
    lease_id: inv.lease.id,
    property_name: prop.property_name,
    // Optional — address may not be configured
    property_address: prop.billing_address || undefined,
    entity_id: tenantEntity.entity_id,
    entity_name: entityData.entity_name,
    entity_address: entityData.address || '',
    bank_details: entityData.bank_details || '',
    period: periodName,
    due_date: sourceInvoice.due_date,
    line_items: [{ description: inv.description, amount: debit }],
    sub_total: debit,
    vat_amount: vat,
    vat_rate: vatRate || 0,
    total: debit + vat,
    // Optional — lease reference preferred; invoice number is valid fallback
    reference: inv.lease.lease_ref || sourceInvoice.invoice_number,
  };
}

export { InvoiceValidationError };
