import {
  ImportedTransaction,
} from "@/app/types/finance";

import {
  determineWorkflowOwner,
} from "@/lib/workflows/routing";

export function applyWorkflowAutomation(
  transaction: ImportedTransaction
): ImportedTransaction {

  let updatedTransaction = {
    ...transaction,
  };

  if (
    updatedTransaction.slaStatus ===
    "breached"
  ) {

    updatedTransaction = {
      ...updatedTransaction,

      queue:
        "escalated",

      requiresEscalation:
        true,

      assignedTo:
        determineWorkflowOwner(
          updatedTransaction
        ),
    };
  }

  if (
    updatedTransaction.manualAllocation
  ) {

    updatedTransaction = {
      ...updatedTransaction,

      assignedTo:
        determineWorkflowOwner(
          updatedTransaction
        ),
    };
  }

  return updatedTransaction;
}