// @ts-ignore: Node 24 requires an explicit .ts extension for native TypeScript execution.
import { requireTransactionDate } from "./transaction-date.ts";

export interface FinancialPeriodCandidate {
  id: string;
  entity_id: string;
  period_type: string;
  status: string;
  period_start: string;
  period_end: string;
}

export function selectFinancialPeriod(
  entityId: string,
  transactionDate: string,
  periods: FinancialPeriodCandidate[],
): string {
  const date = requireTransactionDate(transactionDate);

  const matches = periods.filter(
    (period) =>
      period.entity_id === entityId &&
      period.period_type === "financial" &&
      period.status === "open" &&
      period.period_start <= date &&
      period.period_end >= date,
  );

  if (matches.length === 0) {
    throw new Error(`No open financial period covers ${date}`);
  }

  if (matches.length > 1) {
    throw new Error(`Overlapping financial periods cover ${date}`);
  }

  return matches[0].id;
}
