import {
  ImportedTransaction,
} from "@/app/types/finance";

export function canAutoCompleteTransaction(
  transaction: ImportedTransaction
) {

  return (

    transaction.isBalanced &&

    transaction.status ===
      "matched" &&

    transaction.queue ===
      "ready" &&

    !transaction.requiresEscalation &&

    !transaction.isSuspense &&

    !transaction.periodLocked
  );
}