import { supabase } from "../supabase";

type PeriodInfo = {
  name: string;
  start: string;
  end: string;
  status: string;
};

export async function getCurrentStatementPeriod(): Promise<PeriodInfo> {
  const { data } = await supabase
    .from("statement_periods")
    .select("period_name, period_start, period_end, status")
    .eq("status", "open")
    .order("period_start", { ascending: false })
    .limit(1)
    .single();

  if (data) {
    return {
      name: data.period_name,
      start: data.period_start,
      end: data.period_end,
      status: data.status,
    };
  }

  // Fallback
  return { name: "July 2026", start: "2026-07-01", end: "2026-07-31", status: "open" };
}

export async function getCurrentFinancialPeriod(): Promise<PeriodInfo> {
  const { data } = await supabase
    .from("statement_periods")
    .select("period_name, period_start, period_end, status")
    .order("period_start", { ascending: false })
    .limit(1)
    .single();

  if (data) {
    return {
      name: data.period_name,
      start: data.period_start,
      end: data.period_end,
      status: data.status,
    };
  }

  return { name: "June 2026", start: "2026-06-01", end: "2026-06-30", status: "open" };
}

export function formatPeriodDates(period: PeriodInfo) {
  const [startYear, startMonth] = period.start.split("-").map(Number);
  const [endYear, endMonth] = period.end.split("-").map(Number);
  const startDate = `${String(startMonth).padStart(2, "0")}/${startYear}`;
  const endDate = `${String(endMonth).padStart(2, "0")}/${endYear}`;
  return { startDate, endDate };
}