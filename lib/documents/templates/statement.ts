import { DocumentBuilder } from '../engine/builder';
import type { DocumentModel, LedgerLine, AgingBucket, ProjectedCharge } from '../types';

interface StatementData {
  ledger: LedgerLine[];
  aging?: AgingBucket[];
  projected?: ProjectedCharge[];
}

export function buildStatement(
  base: { header_message?: string; footer_message?: string; deposit_held?: number; payment_terms?: string; banking?: any },
  metadata: DocumentModel['metadata'],
  company: DocumentModel['company'],
  customer: DocumentModel['customer'],
  branding: DocumentModel['branding'],
  data: StatementData
): DocumentModel {
  const builder = new DocumentBuilder({ metadata, company, customer, branding, ...base });
  builder.addSection('ledger', 'Transaction History', data.ledger);
  if (data.aging?.length) builder.addSection('aging', 'Aging Summary', data.aging);
  if (data.projected?.length) builder.addSection('projected', 'Projected Charges', data.projected);

  const last = data.ledger[data.ledger.length - 1];
  const first = data.ledger[0];
  builder.setTotals({ subtotal: 0, vat_total: 0, total: 0, payments_received: 0, credits_applied: 0, balance_due: last?.balance || 0, opening_balance: first?.balance || 0, closing_balance: last?.balance || 0 });
  return builder.build();
}
