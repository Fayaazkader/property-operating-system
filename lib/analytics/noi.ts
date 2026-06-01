type NoiMetricsInput = {
  grossRevenue: number;
  operatingExpenses: number;
};

export function calculateNoiMetrics({
  grossRevenue,
  operatingExpenses,
}: NoiMetricsInput) {
  const netOperatingIncome =
    grossRevenue - operatingExpenses;

  const expenseRatio =
    grossRevenue === 0
      ? 0
      : (operatingExpenses /
          grossRevenue) *
        100;

  return {
    grossRevenue,
    operatingExpenses,
    netOperatingIncome,
    expenseRatio:
      Number(
        expenseRatio.toFixed(2)
      ),
  };
}