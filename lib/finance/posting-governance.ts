import {
  ImportedTransaction,
} from "@/app/types/finance";

export function canPostTransaction(
  transaction: ImportedTransaction
) {

  return (

    transaction.isBalanced &&

    transaction.queue ===
      "ready" &&

    transaction.status ===
      "matched" &&

    transaction.postingStatus !==
      "posted" &&

    !transaction.periodLocked
  );
}