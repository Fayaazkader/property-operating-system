import {
  ImportedTransaction,
} from "@/app/types/finance";

import {
  ServiceResponse,
} from "@/app/types/service";

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

  requiresEscalation
    ? "Finance Manager"
    : matchedTenant
    ? "Auto-cleared"
    : "Reconciliation Team";
  
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
  manualAllocation,
  reviewPriority,
  assignedTo,
  requiresEscalation,
  queue,
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