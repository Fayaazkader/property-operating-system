export type UserRole =
  | "admin"
  | "finance_manager"
  | "reconciliation_officer"
  | "operations_manager"
  | "portfolio_manager"
  | "viewer"
  | "tenant";

export type SystemUser = {
  id: string;

  name: string;

  email: string;

  role: UserRole;
};