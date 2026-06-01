export type Role =
  | "executive"
  | "admin"
  | "leasing"
  | "finance"
  | "operations";

export type Permission =
  | "view_dashboard"
  | "manage_leases"
  | "manage_tasks"
  | "view_financials"
  | "manage_documents";

export type RolePermissions = {
  role: Role;

  permissions: Permission[];
};