import {
  SplitAllocation,
} from "@/app/types/allocation";
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
export type TransactionActivity = {
  id: string;

  label: string;

  timestamp: string;
};
export type ImportedTransaction = {
  id: string;
  entityId?: string;
  activity?: TransactionActivity[];

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
  matchReasons?: string[];
  allocationAction?: string;
  manualAllocation?: boolean;
  allocationCategory?: string;
  splitAllocations?: SplitAllocation[];
  allocationStatus?:
  | "unallocated"
  | "partially_allocated"
  | "fully_allocated"
  | "suspense";
  isBalanced?: boolean;
  outstandingBalance?: number;
  periodLocked?: boolean;
  isSuspense?: boolean;
  reviewPriority?:
  | "low"
  | "medium"
  | "high";
  workflowStatus?:
  | "unassigned"
  | "assigned"
  | "in_review"
  | "escalated"
  | "resolved"
  | "posted";
  postingStatus?:
  | "pending"
  | "approved"
  | "posted"
  | "finalized";
  slaStatus?:
  | "within_sla"
  | "attention_required"
  | "breached";
  assignedTo?: string;
  requiresEscalation?: boolean;
  governanceBlocked?: boolean;
  governanceReason?: string;
  queue?: TransactionQueue;
  postedAt?: string;

postedBy?: string;
  
};
export type OperationalAuditEvent =
  {
    id: string;

    action: string;

    severity:
      | "info"
      | "warning"
      | "critical";

    transactionId?: string;

    createdAt: string;
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
export type OperationalActivity = {
  id: string;

  title: string;

  description: string;

  severity:
    | "info"
    | "warning"
    | "critical";

  createdAt: string;
};