import { supabase } from "@/lib/supabase";

export type StatementContinuityResult = {
  valid: boolean;
  previousStatementId?: string;
  previousClosingBalance?: number;
  reason?: string;
};

export async function validateStatementContinuity(
  bankAccountId: string,
  openingBalance: number
): Promise<StatementContinuityResult> {
  const { data: latestStatement, error } = await supabase
    .from("bank_statements")
    .select("id, closing_balance, statement_date")
    .eq("bank_account_id", bankAccountId)
    .order("statement_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to verify bank statement continuity: ${error.message}`
    );
  }

  // First statement for this account.
  if (!latestStatement) {
    return {
      valid: true,
    };
  }

  const difference =
    Math.round((openingBalance - latestStatement.closing_balance) * 100) / 100;

  if (Math.abs(difference) > 0.01) {
    return {
      valid: false,
      previousStatementId: latestStatement.id,
      previousClosingBalance: latestStatement.closing_balance,
      reason:
        `Opening balance R${openingBalance.toLocaleString("en-ZA", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} does not match the previous statement closing balance of ` +
        `R${latestStatement.closing_balance.toLocaleString("en-ZA", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}. Difference: R${difference.toLocaleString("en-ZA", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}.`,
    };
  }

  return {
    valid: true,
    previousStatementId: latestStatement.id,
    previousClosingBalance: latestStatement.closing_balance,
  };
}

export async function hasOverlappingStatement(
  bankAccountId: string,
  startDate: string,
  endDate: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("bank_statements")
    .select("id")
    .eq("bank_account_id", bankAccountId)
    .gte("statement_date", startDate)
    .lte("statement_date", endDate)
    .limit(1);

  if (error) {
    throw new Error(
      `Unable to check for overlapping bank statements: ${error.message}`
    );
  }

  return (data?.length ?? 0) > 0;
}