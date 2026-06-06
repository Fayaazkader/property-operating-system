import {
  ImportedTransaction,
} from "@/app/types/finance";

export function getTransactionExceptionReason(
  transaction: ImportedTransaction
) {

  if (
    !transaction.isBalanced
  ) {

    return (
      "Outstanding allocation"
    );
  }

  if (
    transaction.requiresEscalation
  ) {

    return (
      "Escalation review required"
    );
  }

  if (
    transaction.isSuspense
  ) {

    return (
      "Suspense allocation unresolved"
    );
  }

  if (
    transaction.periodLocked
  ) {

    return (
      "Financial period locked"
    );
  }

  return null;
}