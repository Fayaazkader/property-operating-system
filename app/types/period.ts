export type FinancialPeriodStatus =
  | "open"
  | "closed";

export type FinancialPeriod = {
  id: string;

  name: string;

  startDate: string;

  endDate: string;

  status:
    FinancialPeriodStatus;

  locked: boolean;

  closedAt?: string;
};

export type TenantStatementPeriod =
  {
    id: string;

    month: string;

    year: number;

    locked: boolean;
  };