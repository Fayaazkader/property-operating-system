import {
  ImportedTransaction,
} from "@/app/types/finance";

export function canFinalizeTransaction(
  transaction: ImportedTransaction
) {

  return (

    transaction.postingStatus ===
      "posted" &&

    !transaction.periodLocked
  );
}