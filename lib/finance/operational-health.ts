import {
  ImportedTransaction,
} from "@/app/types/finance";

export function getOperationalHealth(
  transactions: ImportedTransaction[]
) {

  const escalatedCount =
    transactions.filter(
      (transaction) =>
        transaction.queue ===
        "escalated"
    ).length;

  const governanceCount =
    transactions.filter(
      (transaction) =>
        transaction.governanceBlocked
    ).length;

  if (
    governanceCount >= 3
  ) {

    return {
      label:
        "Governance Attention Required",

      severity:
        "critical",
    };
  }

  if (
    escalatedCount >= 5
  ) {

    return {
      label:
        "High Escalation Risk",

      severity:
        "warning",
    };
  }

  return {
    label:
      "Operations Stable",

    severity:
      "healthy",
  };
}