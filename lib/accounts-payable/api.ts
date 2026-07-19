// lib/accounts-payable/api.ts

import { apEngine } from './engine';
import type { SupplierInvoiceInput, CreditNoteInput, RecurringExpenseInput } from './engine';

export const apApi = {
  captureInvoice: (input: SupplierInvoiceInput, postImmediately?: boolean) => apEngine.captureInvoice(input, postImmediately),
  postInvoice: (invoiceId: string, postedBy: string) => apEngine.postInvoice(invoiceId, postedBy),
  issueCreditNote: (input: CreditNoteInput) => apEngine.issueCreditNote(input),
  createRecurringExpense: (input: RecurringExpenseInput) => apEngine.createRecurringExpense(input),
  matchRecurringExpense: (transaction: { description: string; amount: number; date: string }) => apEngine.matchRecurringExpense(transaction),
  getSupplierLedger: (supplierId: string) => apEngine.getSupplierLedger(supplierId),
  getInvoicesAwaitingApproval: (entityId: string) => apEngine.getInvoicesAwaitingApproval(entityId),
  getOutstandingAP: (entityId: string) => apEngine.getOutstandingAP(entityId),
  getAging: (entityId: string) => apEngine.getAging(entityId),
};
