import {
  ImportedTransaction,
} from "@/app/types/finance";

import {
  canAutoCompleteTransaction,
} from "@/lib/finance/completion";

export function getBulkCompletableTransactions(
  transactions: ImportedTransaction[]
) {

  return transactions.filter(
    (transaction) =>
      canAutoCompleteTransaction(
        transaction
      )
  );
}