import {
  FinancialPeriod,
} from "@/app/types/period";

export const financialPeriods: FinancialPeriod[] =
  [
    {
      id: crypto.randomUUID(),

      name:
        "January 2026",

      startDate:
        "2026-01-01",

      endDate:
        "2026-01-31",

      status:
        "closed",

      locked: true,

      closedAt:
        "2026-02-05",
    },

    {
      id: crypto.randomUUID(),

      name:
        "February 2026",

      startDate:
        "2026-02-01",

      endDate:
        "2026-02-28",

      status:
        "open",

      locked: false,
    },
  ];