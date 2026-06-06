import {
  ImportedTransaction,
} from "@/app/types/finance";

export function determineAllocationStatus(
  transaction: ImportedTransaction
) {

  if (
    transaction.isSuspense
  ) {

    return "suspense";
  }

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

  if (
    allocatedAmount <= 0
  ) {

    return "unallocated";
  }

  if (
    allocatedAmount <
    transaction.amount
  ) {

    return "partially_allocated";
  }

  return "fully_allocated";
}