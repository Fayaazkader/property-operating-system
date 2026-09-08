import {
  validateStatementContinuity,
  hasOverlappingStatement,
} from "@/lib/banking/continuity";

export async function validateBankStatementGovernance(
  bankAccountId: string,
  openingBalance: number | null,
  startDate: string,
  endDate: string
) {
  if (!bankAccountId) {
    return {
      valid: false,
      reason: "No bank account was selected.",
    };
  }

  if (openingBalance === null) {
    return {
      valid: false,
      reason:
        "The bank statement opening balance could not be determined. Select a template that maps the statement opening balance.",
    };
  }

  if (!startDate || !endDate) {
    return {
      valid: false,
      reason: "The bank statement date range could not be determined.",
    };
  }

  if (startDate > endDate) {
    return {
      valid: false,
      reason: "The bank statement start date is after its end date.",
    };
  }

  const continuity = await validateStatementContinuity(
    bankAccountId,
    openingBalance
  );

  if (!continuity.valid) {
    return {
      valid: false,
      reason:
        continuity.reason ||
        "Opening balance does not match the previous statement closing balance.",
    };
  }

  const overlapping = await hasOverlappingStatement(
    bankAccountId,
    startDate,
    endDate
  );

  if (overlapping) {
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