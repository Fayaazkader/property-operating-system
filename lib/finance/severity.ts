import {
  ImportedTransaction,
} from "@/app/types/finance";

export function getTransactionSeverity(
  transaction: ImportedTransaction
) {

  if (
    transaction.governanceBlocked ||
    transaction.requiresEscalation
  ) {

    return "critical";
  }

  if (
    transaction.isSuspense ||
    !transaction.isBalanced
  ) {

    return "warning";
  }

  return "info";
}