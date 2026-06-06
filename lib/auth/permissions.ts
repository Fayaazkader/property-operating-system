import {
  UserRole,
} from "@/app/types/auth";

export function canPostTransactions(
  role: UserRole
) {
  return [
    "admin",
    "finance_manager",
  ].includes(role);
}

export function canClearEscalations(
  role: UserRole
) {
  return [
    "admin",
    "finance_manager",
  ].includes(role);
}

export function canReviewTransactions(
  role: UserRole
) {
  return [
    "admin",
    "finance_manager",
    "reconciliation_officer",
  ].includes(role);
}
export function canAssignReviews(
  role: UserRole
) {
  return [
    "admin",
    "finance_manager",
    "operations_manager",
  ].includes(role);
}

export function canEscalateTransactions(
  role: UserRole
) {
  return [
    "admin",
    "finance_manager",
  ].includes(role);
}
export function canManageAllocationCategories(
  role: UserRole
) {
  return [
    "admin",
    "portfolio_manager",
  ].includes(role);
}