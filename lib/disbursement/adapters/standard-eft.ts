// lib/disbursement/adapters/standard-eft.ts
// Standard EFT Bank Adapter

import type { BankFile } from '../types';

export function generateStandardEFT(batch: any, payments: any[]): BankFile {
  const lines: string[] = [];
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');

  lines.push(`H${batch.batch_number.padEnd(20)}${dateStr}${String(batch.payment_count).padStart(6, '0')}${String(batch.total_amount * 100).padStart(15, '0')}`);

  for (const payment of payments) {
    const account = payment.bank_account || {};
    lines.push(
      `P${(account.account_number || '').padEnd(15)}${(account.branch_code || '').padEnd(6)}${String(payment.amount * 100).padStart(15, '0')}${(account.account_holder || '').padEnd(30)}${(account.reference || '').padEnd(20)}`
    );
  }

  lines.push(`T${String(batch.payment_count).padStart(6, '0')}${String(batch.total_amount * 100).padStart(15, '0')}`);

  return {
    batch_id: batch.id,
    format: 'standard',
    adapter: 'standard_eft',
    content: lines.join('\n'),
    total_amount: batch.total_amount,
    payment_count: batch.payment_count,
    generated_at: new Date().toISOString(),
  };
}
