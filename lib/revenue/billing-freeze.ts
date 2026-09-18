// lib/revenue/billing-freeze.ts
// Billing Freeze — Creates authoritative invoice, accounting and statement records

import { supabase } from '@/lib/supabase';
import { postingEngine } from '@/lib/financial/posting-engine';
import {
  calculateDueDate,
  resolvePaymentTerms,
} from '@/lib/revenue/payment-terms';

export interface FreezeResult {
  tenant_id: string;
  tenant_name: string;
  posted: boolean;
  invoice_id?: string;
  statement_id?: string;
  error?: string;
}

interface FreezeTenant {
  tenantId: string;
  tenantName: string;
  property_name: string;
  leaseId: string;
  leaseRef?: string;
  charges: Array<{
    source: string;
    description: string;
    amount: number;
    vatAmount: number;
    total: number;
  }>;
}

export async function freezeBilling(params: {
  entityId: string;
  periodId: string;
  periodName: string;
  periodStart: string;
  tenants: FreezeTenant[];
}): Promise<{ results: FreezeResult[]; invoiceIds: string[] }> {
  const results: FreezeResult[] = [];
  const invoiceIds: string[] = [];

  /*
   * Resolve the statement period once.
   *
   * The statement period is deliberately separate from the financial
   * period. Billing may be frozen while the underlying financial period
   * remains open.
   */
  const { data: statementPeriod, error: statementPeriodError } =
    await supabase
      .from('financial_periods')
      .select('id, period_name, period_start, period_end, period_type, status')
      .eq('id', params.periodId)
      .eq('entity_id', params.entityId)
      .eq('period_type', 'statement')
      .single();

  if (statementPeriodError || !statementPeriod) {
    throw new Error(
      statementPeriodError?.message ||
        `Statement period ${params.periodId} could not be located`,
    );
  }

  if (statementPeriod.status !== 'open') {
    throw new Error(
      `Statement period ${statementPeriod.period_name} is not open`,
    );
  }

  const billingDate =
    params.periodStart || statementPeriod.period_start;

  for (const tenant of params.tenants) {
    try {
      if (!tenant.tenantId) {
        throw new Error('Tenant ID is missing');
      }

      if (!tenant.leaseId) {
        throw new Error('Lease ID is missing');
      }

      /*
       * ---------------------------------------------------------------
       * 1. Resolve lease/property information needed by the invoice.
       * ---------------------------------------------------------------
       */
      const { data: lease, error: leaseError } = await supabase
        .from('leases')
        .select('id, property_id, lease_ref')
        .eq('id', tenant.leaseId)
        .single();

      if (leaseError || !lease) {
        throw new Error(
          leaseError?.message ||
            `Lease ${tenant.leaseId} could not be located`,
        );
      }

      if (!lease.property_id) {
        throw new Error(`Lease ${tenant.leaseId} has no property`);
      }

      /*
       * ---------------------------------------------------------------
       * 2. Resolve governed payment terms.
       * ---------------------------------------------------------------
       */
      const paymentTerms = await resolvePaymentTerms(tenant.leaseId);
      const dueDate = calculateDueDate(billingDate, paymentTerms);

      /*
       * ---------------------------------------------------------------
       * 3. Calculate authoritative invoice totals from the worksheet.
       * ---------------------------------------------------------------
       *
       * The worksheet is the billing authority at freeze time.
       * We preserve its calculated VAT and totals in the invoice.
       */
      const billableCharges = tenant.charges.filter(
        (charge) => charge.total !== 0,
      );

      const subtotal = billableCharges.reduce(
        (sum, charge) => sum + Number(charge.amount || 0),
        0,
      );

      const vatAmount = billableCharges.reduce(
        (sum, charge) => sum + Number(charge.vatAmount || 0),
        0,
      );

      const totalAmount = billableCharges.reduce(
        (sum, charge) => sum + Number(charge.total || 0),
        0,
      );

      if (totalAmount <= 0) {
        throw new Error(
          `Cannot issue invoice for ${tenant.tenantName}: invoice total is zero`,
        );
      }

      /*
       * ---------------------------------------------------------------
       * 4. Create/recover the authoritative invoice.
       * ---------------------------------------------------------------
       *
       * Invoice number is deterministic for this billing run, making
       * retries safe without inventing another invoice.
       */
      const invoiceNumber =
        `INV-${params.periodName}-${tenant.tenantId}`;

      let invoiceId: string;

      const { data: existingInvoice, error: existingInvoiceError } =
        await supabase
          .from('invoices')
          .select(
            'id, invoice_number, invoice_status, version, subtotal_amount, vat_amount, total_amount',
          )
          .eq('invoice_number', invoiceNumber)
          .maybeSingle();

      if (existingInvoiceError) {
        throw new Error(
          `Unable to check existing invoice ${invoiceNumber}: ${existingInvoiceError.message}`,
        );
      }

      if (existingInvoice) {
        invoiceId = existingInvoice.id;

        /*
         * If the invoice is already issued, this tenant was completed
         * previously. Do not recreate or repost it.
         */
        if (
          existingInvoice.invoice_status === 'issued' ||
          existingInvoice.invoice_status === 'paid'
        ) {
          invoiceIds.push(invoiceId);

          const { data: stmt } = await supabase
            .from('statements_generated')
            .select('id')
            .eq('entity_id', params.entityId)
            .eq('tenant_id', tenant.tenantId)
            .contains('statement_data', {
              invoice_id: invoiceId,
            })
            .order('generated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          results.push({
            tenant_id: tenant.tenantId,
            tenant_name: tenant.tenantName,
            posted: true,
            invoice_id: invoiceId,
            statement_id: stmt?.id,
          });

          continue;
        }
      } else {
        const { data: createdInvoice, error: invoiceError } =
          await supabase
            .from('invoices')
            .insert({
              invoice_number: invoiceNumber,
              lease_id: tenant.leaseId,
              tenant_id: tenant.tenantId,
              property_id: lease.property_id,
              entity_id: params.entityId,
              invoice_status: 'draft',
              billing_period_start:
                statementPeriod.period_start || billingDate,
              billing_period_end:
                statementPeriod.period_end || billingDate,
              invoice_date: billingDate,
              due_date: dueDate,
              subtotal_amount: subtotal,
              vat_amount: vatAmount,
              total_amount: totalAmount,
              outstanding_amount: totalAmount,
              currency: 'ZAR',
              payment_status: 'unpaid',
              version: 1,
              statement_period_locked: true,
            })
            .select('id')
            .single();

        if (invoiceError || !createdInvoice?.id) {
          throw new Error(
            invoiceError?.message ||
              `Invoice ${invoiceNumber} could not be created`,
          );
        }

        invoiceId = createdInvoice.id;
      }

      /*
       * ---------------------------------------------------------------
       * 5. Ensure invoice line items exist.
       * ---------------------------------------------------------------
       *
       * We only create them if none exist, making a retry safe.
       */
      const { data: existingLineItems, error: lineLookupError } =
        await supabase
          .from('invoice_line_items')
          .select('id')
          .eq('invoice_id', invoiceId)
          .limit(1);

      if (lineLookupError) {
        throw new Error(
          `Unable to inspect invoice line items: ${lineLookupError.message}`,
        );
      }

      if (!existingLineItems?.length) {
        const lineItems = billableCharges.map((charge) => ({
          invoice_id: invoiceId,
          lease_id: tenant.leaseId,
          line_item_type: charge.source,
          description: charge.description,
          quantity: 1,
          unit_rate: Number(charge.amount || 0),
          amount: Number(charge.amount || 0),
          vat_applicable: Number(charge.vatAmount || 0) > 0,
          vat_amount: Number(charge.vatAmount || 0),
          total_amount: Number(charge.total || 0),
          billing_category: charge.source,
        }));

        const { error: lineInsertError } = await supabase
          .from('invoice_line_items')
          .insert(lineItems);

        if (lineInsertError) {
          throw new Error(
            `Invoice line items could not be created: ${lineInsertError.message}`,
          );
        }
      }

      /*
       * ---------------------------------------------------------------
       * 6. Post accounting using the existing PostingEngine.
       * ---------------------------------------------------------------
       *
       * invoice_id travels in metadata. The PostingEngine remains the
       * authoritative accounting mechanism and remains atomic/idempotent.
       */
      for (const charge of billableCharges) {
        if (Number(charge.amount || 0) <= 0) continue;

        let businessEvent = 'rental_invoice_raised';

        if (charge.source === 'utility') {
          businessEvent = 'recovery_invoice_raised';
        }

        await postingEngine.post({
          source_engine: 'revenue',
          business_event: businessEvent,
          entity_id: params.entityId,
          amount: Number(charge.amount || 0),
          period_id: undefined,
          occurred_at: new Date().toISOString(),
          effective_date: billingDate,
          dimensions: {
            tenant_id: tenant.tenantId,
            lease_id: tenant.leaseId,
            property_id: lease.property_id,
          },
          reference: invoiceId,
metadata: {
  source_id: `${invoiceId}:${charge.source}:${charge.description}`,
  invoice_id: invoiceId,
  charge_type: charge.source,
  description: charge.description,
  created_by: 'system',
},
        });
      }

      /*
       * ---------------------------------------------------------------
       * 7. Mark invoice issued only after accounting succeeded.
       * ---------------------------------------------------------------
       */
      const { error: issueError } = await supabase
        .from('invoices')
        .update({
          invoice_status: 'issued',
          payment_status: 'unpaid',
          outstanding_amount: totalAmount,
          statement_period_locked: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)
        .eq('invoice_status', 'draft');

      if (issueError) {
        throw new Error(
          `Invoice ${invoiceNumber} could not be issued: ${issueError.message}`,
        );
      }

      /*
       * ---------------------------------------------------------------
       * 8. Create the statement snapshot separately.
       * ---------------------------------------------------------------
       */
      const { data: statement, error: statementError } =
        await supabase
          .from('statements_generated')
          .insert({
            entity_id: params.entityId,
            tenant_id: tenant.tenantId,
            statement_data: {
              invoice_id: invoiceId,
              invoice_ref: invoiceNumber,
              tenant_name: tenant.tenantName,
              property_name: tenant.property_name || 'Unknown',
              statement_date: billingDate,
              charges: billableCharges,
              closing_balance: totalAmount,
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

      if (statementError) {
        throw new Error(
          `Statement could not be created for invoice ${invoiceNumber}: ${statementError.message}`,
        );
      }

      invoiceIds.push(invoiceId);

      results.push({
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName,
        posted: true,
        invoice_id: invoiceId,
        statement_id: statement?.id,
      });
    } catch (err: any) {
      results.push({
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName,
        posted: false,
        error: err instanceof Error ? err.message : 'Unknown billing error',
      });
    }
  }

  return { results, invoiceIds };
}