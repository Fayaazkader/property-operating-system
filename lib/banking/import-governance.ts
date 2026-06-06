import {
  validateStatementContinuity,
  hasOverlappingStatement,
} from "@/lib/banking/continuity";

export function validateBankImport(
  openingBalance: number,
  startDate: string,
  endDate: string
) {

  if (
    !validateStatementContinuity(
      openingBalance
    )
  ) {

    return {
      valid: false,

      reason:
        "Opening balance does not match previous statement closing balance.",
    };
  }

  if (
    hasOverlappingStatement(
      startDate,
      endDate
    )
  ) {

    return {
      valid: false,

      reason:
        "Statement period overlaps with an existing imported statement.",
    };
  }

  return {
    valid: true,
  };
}