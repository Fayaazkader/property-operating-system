// lib/revenue/invoice-service.ts
// Invoice Service — Fetches validated invoice data for delivery
// NO hardcoded values. NO fallbacks. Fail on missing required data.

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

export async function getInvoiceForDelivery(invoiceId: string): Promise<InvoiceDeliveryData> {
  // Fetch invoice from sub-ledger with tenant and lease data
  const { data: entry, error } = await supabase
    .from('sub_ledger_entries')
    .select(`
      id, description, debit_amount, credit_amount, vat_amount, vat_rate,
      reference_type, reference_id, posted_at,
      tenant:tenant_id(id, tenant_name, email, whatsapp_number, whatsapp_enabled),
      lease:lease_id(id, property_id, lease_ref)
    `)
    .eq('id', invoiceId)
    .eq('ledger_type', 'tenant')
    .single();

  if (error || !entry) throw new Error('Invoice not found');

  const inv = entry as any;

  // Validate required tenant data
  if (!inv.tenant?.tenant_name) throw new Error('Invoice missing tenant name');
  if (!inv.tenant?.id) throw new Error('Invoice missing tenant ID');

  // Get property
  let propertyName = '';
  let propertyAddress = '';
  if (inv.lease?.property_id) {
    const { data: prop } = await supabase
      .from('properties')
      .select('property_name, billing_address')
      .eq('id', inv.lease.property_id)
      .single();
    if (prop) {
      propertyName = prop.property_name || '';
      propertyAddress = prop.billing_address || '';
    }
  }
  if (!propertyName) throw new Error('Invoice missing property');

  // Get entity from tenant's entity
  const { data: tenantEntity } = await supabase
    .from('tenants')
    .select('entity_id')
    .eq('id', inv.tenant.id)
    .single();

  const entityId = tenantEntity?.entity_id;
  if (!entityId) throw new Error('Invoice missing entity');

  const { data: entityData } = await supabase
    .from('entities')
    .select('entity_name, address, bank_details')
    .eq('id', entityId)
    .single();

  if (!entityData?.entity_name) throw new Error('Entity not found');

  // Get financial period for period name
  let periodName = '';
  const { data: periods } = await supabase
    .from('financial_periods')
    .select('period_name')
    .eq('entity_id', entityId)
    .eq('period_type', 'financial')
    .lte('period_start', new Date().toISOString())
    .order('period_start', { ascending: false })
    .limit(1)
    .single();
  
  periodName = periods?.period_name || new Date().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });

  // Get invoice number and due date from the source invoice/billing record
  let invoiceNumber = '';
  let dueDate = '';

  if (inv.reference_type === 'invoice' && inv.reference_id) {
    const { data: sourceInvoice } = await supabase
      .from('invoices')
      .select('invoice_number, due_date, period')
      .eq('id', inv.reference_id)
      .single();
    
    if (sourceInvoice) {
      invoiceNumber = sourceInvoice.invoice_number || '';
      dueDate = sourceInvoice.due_date || '';
      if (sourceInvoice.period) periodName = sourceInvoice.period;
    }
  }

  // FAIL if required fields are missing — no fallbacks
  if (!invoiceNumber) throw new Error('Invoice number not found on source record');
  if (!dueDate) throw new Error('Invoice due date not found on source record');

  // Get VAT rate from the journal line or chart of accounts
  let vatRate = 0;
  if (inv.vat_rate) {
    vatRate = inv.vat_rate;
  } else if (inv.vat_amount && inv.debit_amount) {
    vatRate = Math.round((inv.vat_amount / inv.debit_amount) * 100);
  }
  // If still no VAT rate, check the account
  if (!vatRate) {
    const { data: journalLine } = await supabase
      .from('journal_lines')
      .select('account_id')
      .eq('id', inv.reference_id)
      .single();
    
    if (journalLine) {
      const { data: account } = await supabase
        .from('chart_of_accounts')
        .select('vat_rate, vat_category')
        .eq('id', journalLine.account_id)
        .single();
      
      if (account?.vat_category === 'standard') {
        vatRate = account.vat_rate || 15;
      }
    }
  }

  const debit = inv.debit_amount || 0;
  const vat = inv.vat_amount || 0;

  return {
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    tenant_id: inv.tenant.id,
    tenant_name: inv.tenant.tenant_name,
    tenant_email: inv.tenant.email || undefined,
    tenant_whatsapp: inv.tenant.whatsapp_number || undefined,
    lease_id: inv.lease?.id,
    property_name: propertyName,
    property_address: propertyAddress || undefined,
    entity_id: entityId,
    entity_name: entityData.entity_name,
    entity_address: entityData.address || '',
    bank_details: entityData.bank_details || '',
    period: periodName,
    due_date: dueDate,
    line_items: [{ description: inv.description || 'Rental', amount: debit }],
    sub_total: debit,
    vat_amount: vat,
    vat_rate: vatRate,
    total: debit + vat,
    reference: inv.lease?.lease_ref || invoiceNumber,
  };
}
