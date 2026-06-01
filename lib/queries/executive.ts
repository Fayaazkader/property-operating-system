import { QueryResult } from "@/app/types/query";

type ExecutiveMetrics = {
  occupancyRate: number;

  netOperatingIncome: number;

  arrearsExposure: number;
};

export async function getExecutiveOverview():
  Promise<
    QueryResult<ExecutiveMetrics>
  > {
  try {
    return {
      data: {
        occupancyRate: 91,

        netOperatingIncome:
          12300000,

        arrearsExposure:
          2400000,
      },

      error: null,
    };
  } catch (error) {
    return {
      data: null,

      error:
        "Failed to load executive overview.",
    };
  }
}