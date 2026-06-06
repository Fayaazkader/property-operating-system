import {
  ImportedTransaction,
} from "@/app/types/finance";

export function isValidEntityAllocation(
  transaction: ImportedTransaction
) {

  if (
    !transaction.propertyId ||
    !transaction.entityId ||
    !transaction.bankAccountId
  ) {

    return false;
  }

  return (
    transaction.propertyId ===
    transaction.entityId
  );
}