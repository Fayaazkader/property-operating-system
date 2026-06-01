type OccupancyMetricsInput = {
  totalGLA: number;
  occupiedGLA: number;
};

export function calculateOccupancyMetrics({
  totalGLA,
  occupiedGLA,
}: OccupancyMetricsInput) {
  const vacantGLA =
    totalGLA - occupiedGLA;

  const occupancyRate =
    totalGLA === 0
      ? 0
      : (occupiedGLA / totalGLA) * 100;

  return {
    totalGLA,
    occupiedGLA,
    vacantGLA,
    occupancyRate:
      Number(
        occupancyRate.toFixed(2)
      ),
  };
}