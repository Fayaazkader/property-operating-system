export type BankTransaction = {
  id: string;

  transactionDate: string;

  description: string;

  amount: number;

  reference?: string;

  allocated: boolean;

  tenantId?: string;

  propertyId?: string;
};

export type ReconciliationMatch = {
  transactionId: string;

  leaseId: string;

  confidence: number;
};
export type TransactionStatus =
  | "unmatched"
  | "matched"
  | "allocated"
  | "flagged";

export type ImportedTransaction = {
  transactionDate: string;

  description: string;

  amount: number;

  reference?: string;

  status?: TransactionStatus;
  matchConfidence?: number;
  matchedTenant?: string;
  matchedLease?: string;
  allocationAction?: string;
  reviewPriority?:
  | "low"
  | "medium"
  | "high";
  requiresEscalation?: boolean;
};