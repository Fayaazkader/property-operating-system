export type BankStatement = {
  id: string;

  accountNumber: string;

  startDate: string;

  endDate: string;

  openingBalance: number;

  closingBalance: number;

  importedAt: string;

  locked: boolean;
};
export type CashbookSnapshot = {
  id: string;

  accountNumber: string;

  balance: number;

  calculatedAt: string;
};