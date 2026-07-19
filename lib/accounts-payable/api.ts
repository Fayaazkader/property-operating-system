// lib/accounts-payable/api.ts
import { apEngine } from './engine';
import type { SupplierInvoiceInput } from './engine';

export const apApi = {
  captureInvoice: (input: SupplierInvoiceInput) => apEngine.captureInvoice(input),
  postInvoice: (invoiceId: string, postedBy: string) => apEngine.postInvoice(invoiceId, postedBy),
  rejectInvoice: (invoiceId: string, reason: string) => apEngine.rejectInvoice(invoiceId, reason),
  approveInvoice: (invoiceId: string, approvedBy: string) => apEngine.approveInvoice(invoiceId, approvedBy),
  getApprovalQueue: (entityId: string) => apEngine.getApprovalQueue(entityId),
  getSupplierLedger: (supplierId: string) => apEngine.getSupplierLedger(supplierId),
  getOutstandingAP: (entityId: string) => apEngine.getOutstandingAP(entityId),
  getAging: (entityId: string) => apEngine.getAging(entityId),
  getMonthEndStatus: (entityId: string) => apEngine.getMonthEndStatus(entityId),
  reconcileStatement: (entityId: string, supplierId: string, lines: Array<{ date: string; description: string; reference?: string; debit?: number; credit?: number }>) => apEngine.reconcileStatement(entityId, supplierId, lines),
  createRecurringExpense: (input: any) => apEngine.createRecurringExpense(input),
};
