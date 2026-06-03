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
const allocationAction =
  matchedLease
    ? `Allocate to ${matchedLease}`
    : "Manual review required";
    const reviewPriority =
  matchedTenant
    ? "low"
    : amount >= 50000
    ? "high"
    : "medium";
    const requiresEscalation =
  !matchedTenant &&
  amount >= 50000;
  const queue =
  requiresEscalation
    ? "escalated"
    : matchedTenant
    ? "ready"
    : "review";

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
  allocationAction,
  reviewPriority,
  requiresEscalation,
  queue,
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