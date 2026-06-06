import {
  financialPeriods,
} from "@/lib/finance/periods";

export function isPeriodLocked(
  transactionDate: string
) {

  const matchingPeriod =
    financialPeriods.find(
      (period) =>

        transactionDate >=
          period.startDate &&

        transactionDate <=
          period.endDate
    );

  if (!matchingPeriod) {
    return false;
  }

  return matchingPeriod.locked;
}