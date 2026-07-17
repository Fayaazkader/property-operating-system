// lib/documents/templates/statement.ts
// Statement template — running ledger + aging + projected

import { DocumentBuilder } from '../engine/builder';
import type { DocumentModel, LedgerLine, AgingBucket, ProjectedCharge } from '../types';

interface StatementData {
  ledger: LedgerLine[];
  aging?: AgingBucket[];
  projected?: ProjectedCharge[];
}

export function buildStatement(base: Omit<Parameters<typeof DocumentBuilder.prototype.constructor>[0], 'metadata' | 'company' | 'customer' | 'branding'>, metadata: DocumentModel['metadata'], company: DocumentModel['company'], customer: DocumentModel['customer'], branding: DocumentModel['branding'], data: StatementData): DocumentModel {
  const builder = new DocumentBuilder({ metadata, company, customer, branding, ...base });

  builder.addSection('ledger', 'Transaction History', data.ledger);

  if (data.aging?.length) {
    builder.addSection('aging', 'Aging Summary', data.aging);
  }

  if (data.projected?.length) {
    builder.addSection('projected', 'Projected Charges', data.projected);
  }

  const lastLine = data.ledger[data.ledger.length - 1];
  const firstLine = data.ledger[0];

  builder.setTotals({
    subtotal: 0,
    vat_total: 0,
    total: 0,
    payments_received: 0,
    credits_applied: 0,
    balance_due: lastLine?.balance || 0,
    opening_balance: firstLine?.balance || 0,
    closing_balance: lastLine?.balance || 0,
  });

  return builder.build();
}
