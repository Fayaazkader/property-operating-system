import {
  ImportedTransaction,
} from "@/app/types/finance";

import {
  AllocationInput,
} from "@/app/types/allocation";

export function applyAllocation(
  transaction: ImportedTransaction,
  allocation: AllocationInput
): ImportedTransaction {

  const updatedAllocations = [
    ...(transaction.splitAllocations || []),

    {
      id: crypto.randomUUID(),

      category:
        allocation.category,

      amount:
        allocation.amount,

      percentage:
        Number(
          (
            (allocation.amount /
              transaction.amount) *
            100
          ).toFixed(2)
        ),
    },
  ];

  const allocatedAmount =
    updatedAllocations.reduce(
      (
        total,
        item
      ) =>
        total + item.amount,
      0
    );

  return {
    ...transaction,

    splitAllocations:
      updatedAllocations,

    outstandingBalance:
      transaction.amount -
      allocatedAmount,

    isBalanced:
      allocatedAmount ===
      transaction.amount,
  };
}