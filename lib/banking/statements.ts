import {
  BankStatement,
} from "@/app/types/banking";

export const importedStatements: BankStatement[] =
  [
    {
      id: crypto.randomUUID(),

      accountNumber:
        "001-558-889",

      startDate:
        "2026-01-01",

      endDate:
        "2026-01-31",

      openingBalance:
        100000,

      closingBalance:
        250000,

      importedAt:
        new Date().toISOString(),

      locked: true,
    },
  ];