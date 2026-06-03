import {
  AllocationTarget,
  ImportedTransaction,
} from "@/app/types/finance";

export function validateEntityBoundary(
  transaction:
    ImportedTransaction,

  target:
    AllocationTarget
) {
  return (
    transaction.entityId ===
    target.entityId
  );
}

export function validatePortfolioBoundary(
  transaction:
    ImportedTransaction,

  target:
    AllocationTarget
) {
  return (
    transaction.portfolioId ===
    target.portfolioId
  );
}

export function validatePropertyBoundary(
  transaction:
    ImportedTransaction,

  target:
    AllocationTarget
) {
  return (
    transaction.propertyId ===
    target.propertyId
  );
}

export function validateAllocationGovernance(
  transaction:
    ImportedTransaction,

  target:
    AllocationTarget
) {

  const validEntity =
    validateEntityBoundary(
      transaction,
      target
    );

  const validPortfolio =
    validatePortfolioBoundary(
      transaction,
      target
    );

  const validProperty =
    validatePropertyBoundary(
      transaction,
      target
    );

  return (
    validEntity &&
    validPortfolio &&
    validProperty
  );
}