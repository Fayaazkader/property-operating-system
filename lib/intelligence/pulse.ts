export type PortfolioPulse = {
  revenue: { current: number; previous: number; variance: number; trend: "up" | "down" | "flat" };
  occupancy: { current: number; previous: number; variance: number; trend: "up" | "down" | "flat" };
  arrears: { current: number; previous: number; variance: number; trend: "up" | "down" | "flat" };
  vacancy: { current: number; previous: number; variance: number; trend: "up" | "down" | "flat" };
};

export function calculatePulse(
  currentRevenue: number, previousRevenue: number,
  currentOccupancy: number, previousOccupancy: number,
  currentArrears: number, previousArrears: number,
  currentVacancy: number, previousVacancy: number
): PortfolioPulse {
  const revVar = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
  const occVar = currentOccupancy - previousOccupancy;
  const arrVar = previousArrears > 0 ? ((currentArrears - previousArrears) / previousArrears) * 100 : 0;
  const vacVar = currentVacancy - previousVacancy;

  return {
    revenue: { current: currentRevenue, previous: previousRevenue, variance: Math.round(revVar * 10) / 10, trend: revVar > 0 ? "up" : revVar < 0 ? "down" : "flat" },
    occupancy: { current: currentOccupancy, previous: previousOccupancy, variance: Math.round(occVar * 10) / 10, trend: occVar > 0 ? "up" : occVar < 0 ? "down" : "flat" },
    arrears: { current: currentArrears, previous: previousArrears, variance: Math.round(arrVar * 10) / 10, trend: arrVar > 0 ? "up" : arrVar < 0 ? "down" : "flat" },
    vacancy: { current: currentVacancy, previous: previousVacancy, variance: vacVar, trend: vacVar > 0 ? "up" : vacVar < 0 ? "down" : "flat" },
  };
}
