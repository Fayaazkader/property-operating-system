import {
  importedStatements,
} from "@/lib/banking/statements";

export function validateStatementContinuity(
  openingBalance: number
) {

  const latestStatement =
    importedStatements[
      importedStatements.length - 1
    ];

  if (!latestStatement) {
    return true;
  }

  return (
    latestStatement.closingBalance ===
    openingBalance
  );
}
export function hasOverlappingStatement(
  startDate: string,
  endDate: string
) {

  return importedStatements.some(
    (statement) =>

      startDate <=
        statement.endDate &&

      endDate >=
        statement.startDate
  );
}