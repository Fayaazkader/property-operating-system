import {
  ImportedTransaction,
} from "@/app/types/finance";

import {
  UserRole,
} from "@/app/types/auth";

export function isTransactionLocked(
  transaction: ImportedTransaction
) {

  return (

  transaction.periodLocked ||

  transaction.queue ===
  "posted" ||

transaction.postingStatus ===
  "finalized" ||

  transaction.workflowStatus ===
    "resolved"
);
}

export function canModifyTransaction(
  transaction: ImportedTransaction,
  role: UserRole
) {

  if (
    role === "admin"
  ) {

    return true;
  }

  return !isTransactionLocked(
    transaction
  );
}