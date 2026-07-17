// lib/documents/templates/invoice.ts
// Invoice template — assembles sections for a tax invoice

import { DocumentBuilder } from '../engine/builder';
import type { DocumentModel, ChargeLine, PaymentReceived, CreditNoteApplied } from '../types';

interface InvoiceData {
  charges: ChargeLine[];
  payments?: PaymentReceived[];
  credit_notes?: CreditNoteApplied[];
}

export function buildInvoice(base: Omit<Parameters<typeof DocumentBuilder.prototype.constructor>[0], 'metadata' | 'company' | 'customer' | 'branding'>, metadata: DocumentModel['metadata'], company: DocumentModel['company'], customer: DocumentModel['customer'], branding: DocumentModel['branding'], data: InvoiceData): DocumentModel {
  const builder = new DocumentBuilder({ metadata, company, customer, branding, ...base });

  builder.addSection('charges', 'Charges', data.charges);

  if (data.credit_notes?.length) {
    builder.addSection('credit_notes', 'Credit Notes', data.credit_notes);
  }

  if (data.payments?.length) {
    builder.addSection('payments', 'Receipts Received', data.payments);
  }

  const subtotal = data.charges.reduce((s, c) => s + c.amount, 0);
  const vatTotal = data.charges.reduce((s, c) => s + c.vat_amount, 0);
  const total = subtotal + vatTotal;
  const paymentsReceived = (data.payments || []).reduce((s, p) => s + p.amount, 0);
  const creditsApplied = (data.credit_notes || []).reduce((s, c) => s + c.amount, 0);

  builder.setTotals({
    subtotal,
    vat_total: vatTotal,
    total,
    payments_received: paymentsReceived,
    credits_applied: creditsApplied,
    balance_due: total - paymentsReceived - creditsApplied,
  });

  return builder.build();
}
