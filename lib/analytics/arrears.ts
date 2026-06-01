type ArrearsMetricsInput = {
  totalOutstanding: number;
  totalMonthlyBilling: number;
};

export function calculateArrearsMetrics({
  totalOutstanding,
  totalMonthlyBilling,
}: ArrearsMetricsInput) {
  const arrearsRatio =
    totalMonthlyBilling === 0
      ? 0
      : (totalOutstanding /
          totalMonthlyBilling) *
        100;

  let arrearsRiskLevel =
    "Low";

  if (arrearsRatio >= 50) {
    arrearsRiskLevel = "High";
  } else if (
    arrearsRatio >= 20
  ) {
    arrearsRiskLevel =
      "Medium";
  }

  return {
    totalOutstanding,
    totalMonthlyBilling,
    arrearsRatio:
      Number(
        arrearsRatio.toFixed(2)
      ),
    arrearsRiskLevel,
  };
}