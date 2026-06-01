type GlaMetricsInput = {
  totalGLA: number;
  occupiedGLA: number;
  vacantGLA?: number;
};

export function calculateGlaMetrics({
  totalGLA,
  occupiedGLA,
  vacantGLA,
}: GlaMetricsInput) {
  const calculatedVacantGLA =
    vacantGLA ??
    totalGLA - occupiedGLA;

  const occupancyEfficiency =
    totalGLA === 0
      ? 0
      : (occupiedGLA / totalGLA) *
        100;

  return {
    totalGLA,
    occupiedGLA,
    vacantGLA:
      calculatedVacantGLA,
    occupancyEfficiency:
      Number(
        occupancyEfficiency.toFixed(
          2
        )
      ),
  };
}