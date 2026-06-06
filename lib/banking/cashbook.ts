import {
  ImportedTransaction,
} from "@/app/types/finance";

export function calculateCashbookBalance(
  openingBalance: number,
  transactions: ImportedTransaction[]
) {

  return transactions.reduce(
    (
      balance,
      transaction
    ) =>
      balance +
      transaction.amount,
    openingBalance
  );
}
export function doesCashbookBalanceMatch(
  expectedBalance: number,
  actualBalance: number
) {

  return (
    expectedBalance ===
    actualBalance
  );
}