import {
  ImportedTransaction,
} from "@/app/types/finance";

export function determineWorkflowOwner(
  transaction: ImportedTransaction
) {

  if (
    transaction.slaStatus ===
    "breached"
  ) {

    return "Operations Manager";
  }

  if (
    transaction.requiresEscalation
  ) {

    return "Finance Manager";
  }
if (
  transaction.isSuspense
) {

  return "Suspense Team";
}
  if (
    transaction.manualAllocation
  ) {

    return "Reconciliation Officer";
  }

  return "Auto-cleared";
}