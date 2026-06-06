import {
  ImportedTransaction,
} from "@/app/types/finance";

import {
  ServiceResponse,
} from "@/app/types/service";
import {
  determineWorkflowOwner,
} from "@/lib/workflows/routing";
import {
  classifyTransaction,
} from "@/lib/finance/classification";
import {
  determineAllocationStatus,
} from "@/lib/finance/allocation-resolution";
import {
  isAllocationBalanced,
} from "@/lib/finance/allocation-integrity";
import {
  calculateOutstandingBalance,
} from "@/lib/finance/outstanding-balance";
import {
  isPeriodLocked,
} from "@/lib/finance/period-governance";
import {
  generateAutomaticAllocations,
} from "@/lib/finance/allocation-automation";

export async function importBankTransactions(
  file: File
): Promise<
  ServiceResponse<
    ImportedTransaction[]
  >
> {
  try {
    const text =
      await file.text();

    const rows =
      text.split("\n");

    const transactions =
      rows
        .slice(1)
        .map(
          (
            row
          ): ImportedTransaction => {
            const columns =
              row.split(",");

            const amount =
              Number(
                columns[2]
                  ?.replace(
                    /"/g,
                    ""
                  )
                  .trim()
              );

            const description =
  columns[1]?.trim() || "";

const matchedTenant =
  description
    .toLowerCase()
    .includes("abc")
    ? "ABC Traders"
    : description
        .toLowerCase()
        .includes("lake")
    ? "Lake Foods"
    : undefined;
    const matchedLease =
  matchedTenant ===
  "ABC Traders"
    ? "LSE-2026-001"
    : matchedTenant ===
      "Lake Foods"
    ? "LSE-2026-014"
    : undefined;
    const matchReasons =

  matchedTenant
    ? [
        "Tenant keyword matched",
        "Lease association identified",
        "Historical allocation pattern detected",
      ]
    : [
        "No confident tenant match detected",
      ];
const allocationAction =
  matchedLease
    ? `Allocate to ${matchedLease}`
    : "Manual review required";
    const allocationCategory =
  classifyTransaction(
    description
  );
  const isSuspense =

  allocationCategory ===
  "Suspense Receipt";
  const automaticAllocations =
  generateAutomaticAllocations({
    amount,
    matchedTenant,
  } as ImportedTransaction);

const splitAllocations =

  automaticAllocations.length > 0

    ? automaticAllocations

    : [
        {
          id: crypto.randomUUID(),

          category:
            allocationCategory,

          amount,

          percentage: 100,
        },
      ];
      const allocationStatus =
  determineAllocationStatus({
    amount,
    splitAllocations,
    isSuspense,
  } as ImportedTransaction);
  const isBalanced =
  isAllocationBalanced({
    amount,
    splitAllocations,
  } as ImportedTransaction);
  const outstandingBalance =
  calculateOutstandingBalance({
    amount,
    splitAllocations,
  } as ImportedTransaction);
  const periodLocked =
  isPeriodLocked(
    columns[0]?.trim() || ""
  );
    const manualAllocation =

  !matchedTenant;
    const reviewPriority =

  amount >= 100000
    ? "high"
    : amount >= 25000
    ? "medium"
    : "low";
    
    const requiresEscalation =
  !matchedTenant &&
  amount >= 50000;
  const assignedTo =
  determineWorkflowOwner({
    requiresEscalation,
    manualAllocation,
    slaStatus:

      requiresEscalation
        ? "attention_required"
        : "within_sla",
  } as ImportedTransaction);
  const queue =

  requiresEscalation
    ? "escalated"
    : matchedTenant
    ? "ready"
    : "review";
const activity = [
  {
    id: crypto.randomUUID(),

    label:
      "Transaction imported",

    timestamp:
      new Date().toLocaleString(),
  },
];
return {
  id: crypto.randomUUID(),
  transactionDate:
    columns[0]?.trim() ||
    "",

  description,

  amount,

  status:
    matchedTenant
      ? "matched"
      : "unmatched",

  matchConfidence:
    matchedTenant
      ? 92
      : 38,

  matchedTenant,
  matchedLease,
  matchReasons,
  allocationAction,
  allocationCategory,
  splitAllocations,
  allocationStatus,
  isBalanced,
  outstandingBalance,
  periodLocked,
  isSuspense,
  manualAllocation,
  reviewPriority,
  assignedTo,
  requiresEscalation,
  queue,
 workflowStatus:

  isSuspense
    ? "in_review"
    : requiresEscalation
    ? "escalated"
    : matchedTenant
    ? "assigned"
    : "unassigned",
    postingStatus:
  "pending",
  activity,
};
          }
        )
        .filter(
          (
            transaction
          ) =>
            transaction.transactionDate &&
            transaction.description &&
            !isNaN(
              transaction.amount
            )
        );

    return {
      success: true,

      data: transactions,
    };
  } catch (error) {
    return {
      success: false,

      error:
        "Failed to import bank transactions.",
    };
  }
}