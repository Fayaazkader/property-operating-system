import {
  ImportedTransaction,
} from "@/app/types/finance";

export function calculateOutstandingBalance(
  transaction: ImportedTransaction
) {

  const allocatedAmount =
    transaction.splitAllocations?.reduce(
      (
        total,
        allocation
      ) =>
        total +
        allocation.amount,
      0
    ) || 0;

  return (
    transaction.amount -
    allocatedAmount
  );
}