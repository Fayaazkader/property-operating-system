import {
  DashboardConfig,
} from "@/app/types/dashboard";

export const executiveDashboard: DashboardConfig =
  [
    {
      id: "occupancy",
      widget:
        "occupancy",
      span: "half",
      priority: 1,
      props: {
        totalGLA: 125000,
        occupiedGLA: 112500,
      },
    },

    {
      id: "noi",
      widget: "noi",
      span: "half",
      priority: 2,
      props: {
        grossRevenue: 18500000,
        operatingExpenses: 6200000,
      },
    },
  ];