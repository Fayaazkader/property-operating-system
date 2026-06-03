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
  id: string;
  entityId?: string;

portfolioId?: string;

propertyId?: string;

bankAccountId?: string;
  transactionDate: string;

  description: string;

  amount: number;

  reference?: string;

  status?:
  | "unmatched"
  | "matched"
  | "allocated"
  | "flagged"
  | "posted";
  matchConfidence?: number;
  matchedTenant?: string;
  matchedLease?: string;
  allocationAction?: string;
  reviewPriority?:
  | "low"
  | "medium"
  | "high";
  requiresEscalation?: boolean;
  governanceBlocked?: boolean;
  governanceReason?: string;
  queue?: TransactionQueue;
};
export type TransactionQueue =
  | "ready"
  | "review"
  | "escalated"
  | "posted"
  | "governance";
  export type AllocationTarget = {
  entityId: string;

  portfolioId: string;

  propertyId: string;

  leaseId: string;

  tenantName: string;
};