import { supabase } from "@/lib/supabase";

export type FinancialPeriodValidation = {
  valid: boolean;
  periodId?: string;
  periodName?: string;
  periodStart?: string;
  periodEnd?: string;
  reason?: string;
};

export async function validateBankImportFinancialPeriod(
  entityId: string,
  startDate: string,
  endDate: string
): Promise<FinancialPeriodValidation> {
  if (!entityId) {
    return {
      valid: false,
      reason: "No entity was selected.",
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

  const { data: period, error } = await supabase
    .from("financial_periods")
    .select(
      "id, period_name, period_start, period_end, status"
    )
    .eq("entity_id", entityId)
    .eq("period_type", "financial")
    .eq("status", "open")
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to determine the open financial period: ${error.message}`
    );
  }

  if (!period) {
    return {
      valid: false,
      reason: "There is no open financial period for this entity.",
    };
  }

  if (
    startDate < period.period_start ||
    endDate > period.period_end
  ) {
    return {
      valid: false,
      periodId: period.id,
      periodName: period.period_name,
      periodStart: period.period_start,
      periodEnd: period.period_end,
      reason:
        `This bank statement falls outside the open financial period ` +
        `${period.period_name} (${period.period_start} to ${period.period_end}). ` +
        `Close the current financial period and open the next financial period before importing transactions beyond ${period.period_end}.`,
    };
  }

  return {
    valid: true,
    periodId: period.id,
    periodName: period.period_name,
    periodStart: period.period_start,
    periodEnd: period.period_end,
  };
}