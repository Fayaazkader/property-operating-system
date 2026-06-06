import {
  ImportedTransaction,
} from "@/app/types/finance";

export function isExceptionTransaction(
  transaction: ImportedTransaction
) {

  return (

    transaction.requiresEscalation ||

    transaction.isSuspense ||

    !transaction.isBalanced ||

    transaction.periodLocked
  );
}