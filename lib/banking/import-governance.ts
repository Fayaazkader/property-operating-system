import { validateStatementContinuity, hasOverlappingStatement } from "@/lib/banking/continuity";

export async function validateBankImport(
  bankAccountId: string,
  openingBalance: number,
  startDate: string,
  endDate: string
) {
  const continuity = await validateStatementContinuity(
    bankAccountId,
    openingBalance
  );

  if (!continuity.valid) {
    return {
      valid: false,
      reason:
        continuity.reason ||
        "Opening balance does not match previous statement closing balance.",
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