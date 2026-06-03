export type Entity = {
  id: string;

  name: string;
};

export type Portfolio = {
  id: string;

  entityId: string;

  name: string;
};

export type Property = {
  id: string;

  portfolioId: string;

  entityId: string;

  name: string;

  propertyType:
    | "retail"
    | "office"
    | "industrial"
    | "mixedUse";
};

export type BankAccount = {
  id: string;

  entityId: string;

  portfolioId: string;

  propertyId?: string;

  bankName: string;

  accountName: string;

  accountNumber: string;
};