import {
  ImportedTransaction,
} from "@/app/types/finance";

export function getEscalatedTransactions(
  transactions:
    ImportedTransaction[]
) {
  return transactions.filter(
    (transaction) =>
      transaction.queue ===
      "escalated"
  );
}

export function getGovernanceBlockedTransactions(
  transactions:
    ImportedTransaction[]
) {
  return transactions.filter(
    (transaction) =>
      transaction.governanceBlocked ===
      true
  );
}

export function getReadyToPostTransactions(
  transactions:
    ImportedTransaction[]
) {
  return transactions.filter(
    (transaction) =>
      transaction.queue ===
      "ready"
  );
}

export function getReadyToPostValue(
  transactions:
    ImportedTransaction[]
) {
  return getReadyToPostTransactions(
    transactions
  ).reduce(
    (
      total,
      transaction
    ) =>
      total +
      transaction.amount,
    0
  );
}

export function getEscalatedExposure(
  transactions:
    ImportedTransaction[]
) {
  return getEscalatedTransactions(
    transactions
  ).reduce(
    (
      total,
      transaction
    ) =>
      total +
      transaction.amount,
    0
  );
}