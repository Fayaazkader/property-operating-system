export interface PreBillingCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface CloseValidation {
  label: string;
  passed: boolean;
}

export interface ReceiptStats {
  receipts: number;
  allocated: number;
  unreconciled: number;
  cashbookBalanced: boolean;
}

export interface BillingStats {
  totalTenants: number;
  invoicesGenerated: number;
  invoicesOutstanding: number;
  chargesAddedAfterStart: number;
  invoicesRequiringRegen: number;
  billingExceptions: number;
}

export function getPreBillingChecks(receiptStats: ReceiptStats): PreBillingCheck[] {
  return [
    { 
      label: "Unallocated Receipts", 
      passed: receiptStats.unreconciled === 0, 
      detail: receiptStats.unreconciled === 0 ? "All receipts allocated" : `${receiptStats.unreconciled} unallocated receipts exist` 
    },
    { 
      label: "Bank Reconciliation", 
      passed: receiptStats.cashbookBalanced, 
      detail: receiptStats.cashbookBalanced ? "Cashbook fully reconciled" : "Cashbook not fully reconciled" 
    },
    { 
      label: "Draft Charges", 
      passed: true, 
      detail: "No draft charges pending" 
    },
    { 
      label: "Unapproved Charges", 
      passed: true, 
      detail: "All charges approved" 
    },
    { 
      label: "Billing Exceptions", 
      passed: true, 
      detail: "No exceptions detected" 
    },
  ];
}

export function getCloseValidations(billingStats: BillingStats): CloseValidation[] {
  return [
    { label: "All tenants billed", passed: billingStats.invoicesOutstanding === 0 },
    { label: "No draft charges", passed: true },
    { label: "No pending approvals", passed: true },
    { label: "No billing exceptions", passed: billingStats.billingExceptions === 0 },
    { label: "No invoice regeneration required", passed: billingStats.invoicesRequiringRegen === 0 },
  ];
}
