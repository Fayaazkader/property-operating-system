import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit/audit-log";
import { getNextPeriodWithDates } from "./period-utils";

export async function closeStatementPeriod(periodName: string): Promise<{ 
  success: boolean; 
  nextPeriod: string; 
  error?: string 
}> {
  // 1. Close current period
  const { error: closeError } = await supabase
    .from("statement_periods")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("period_name", periodName)
    .eq("status", "open");

  if (closeError) {
    return { success: false, nextPeriod: "", error: closeError.message };
  }

  // 2. Create next period
  const { nextPeriod, startDate, endDate } = getNextPeriodWithDates(periodName);

  const { data: existingNext } = await supabase
    .from("statement_periods")
    .select("id")
    .eq("period_name", nextPeriod)
    .limit(1);

  if (!existingNext || existingNext.length === 0) {
    const { error: insertError } = await supabase
      .from("statement_periods")
      .insert({
        period_name: nextPeriod,
        period_start: startDate,
        period_end: endDate,
        status: "open",
      });

    if (insertError) {
      // Rollback: reopen the period
      await supabase
        .from("statement_periods")
        .update({ status: "open", closed_at: null })
        .eq("period_name", periodName);
      
      return { success: false, nextPeriod: "", error: insertError.message };
    }
  }

  // 3. Audit
  await logAudit({
    action: "update",
    resource_type: "period",
    resource_label: `Statement period ${periodName} closed`,
    old_values: { status: "open" },
    new_values: { status: "closed", period: periodName }
  });

  return { success: true, nextPeriod };
}

export async function closeFinancialPeriod(periodName: string): Promise<{ 
  success: boolean; 
  nextPeriod: string; 
  error?: string 
}> {
  // 1. Close current period
  const { error: closeError } = await supabase
    .from("financial_periods")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("period_name", periodName);

  if (closeError) {
    return { success: false, nextPeriod: "", error: closeError.message };
  }

  // 2. Create next period
  const { nextPeriod, startDate, endDate } = getNextPeriodWithDates(periodName);

  const { data: existingNext } = await supabase
    .from("financial_periods")
    .select("id")
    .eq("period_name", nextPeriod)
    .limit(1);

  if (!existingNext || existingNext.length === 0) {
    const { error: insertError } = await supabase
      .from("financial_periods")
      .insert({
        period_name: nextPeriod,
        period_start: startDate,
        period_end: endDate,
        status: "open",
      });

    if (insertError) {
      // Rollback: reopen the period
      await supabase
        .from("financial_periods")
        .update({ status: "open", closed_at: null })
        .eq("period_name", periodName);
      
      return { success: false, nextPeriod: "", error: insertError.message };
    }
  }

  // 3. Audit
  await logAudit({
    action: "update",
    resource_type: "financial_period",
    resource_label: `Financial period ${periodName} closed`,
    old_values: { status: "open" },
    new_values: { status: "closed", period: periodName }
  });

  return { success: true, nextPeriod };
}
