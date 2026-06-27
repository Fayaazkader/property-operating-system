export type PropertyHealth = {
  score: number;
  breakdown: {
    category: string;
    points: number;
    maxPoints: number;
    status: "good" | "warning" | "critical";
  }[];
  tenantConcentration: {
    tenantName: string;
    revenue: number;
    percentage: number;
  }[];
};

export function calculatePropertyHealth(
  occupancy: { occupancy: number; vacant: number },
  financial: { monthlyRevenue: number; arrears: number },
  expiring: any[],
  activeLeases: any[]
): PropertyHealth {
  const occupancyScore = occupancy.occupancy >= 90 ? 30 : occupancy.occupancy >= 70 ? 20 : 10;
  const arrearsPct = financial.monthlyRevenue > 0 ? financial.arrears / financial.monthlyRevenue : 0;
  const arrearsScore = arrearsPct < 0.1 ? 20 : arrearsPct < 0.3 ? 10 : 0;
  const vacancyScore = occupancy.vacant === 0 ? 20 : occupancy.vacant <= 2 ? 15 : occupancy.vacant <= 5 ? 10 : 0;
  const renewalRisk = activeLeases.length > 0 ? expiring.length / activeLeases.length : 0;
  const renewalScore = renewalRisk === 0 ? 20 : renewalRisk < 0.2 ? 15 : renewalRisk < 0.4 ? 10 : 0;
  const arrearsTotalScore = financial.arrears <= 0 ? 10 : financial.arrears < 10000 ? 5 : 0;

  const score = Math.min(100, occupancyScore + arrearsScore + vacancyScore + renewalScore + arrearsTotalScore);

  // Tenant concentration
  const tenantRevenue = new Map<string, number>();
  activeLeases.forEach(l => {
    const name = (l as any).tenants?.tenant_name || "Unknown";
    const rev = l.monthly_rental || 0;
    tenantRevenue.set(name, (tenantRevenue.get(name) || 0) + rev);
  });

  const totalRevenue = Array.from(tenantRevenue.values()).reduce((s, v) => s + v, 0);
  const concentration = Array.from(tenantRevenue.entries())
    .map(([tenantName, revenue]) => ({
      tenantName,
      revenue,
      percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5);

  return {
    score,
    breakdown: [
      { category: "Occupancy", points: occupancyScore, maxPoints: 30, status: occupancyScore >= 25 ? "good" : occupancyScore >= 15 ? "warning" : "critical" },
      { category: "Arrears", points: arrearsScore, maxPoints: 20, status: arrearsScore >= 15 ? "good" : arrearsScore >= 5 ? "warning" : "critical" },
      { category: "Vacancy", points: vacancyScore, maxPoints: 20, status: vacancyScore >= 15 ? "good" : vacancyScore >= 10 ? "warning" : "critical" },
      { category: "Renewals", points: renewalScore, maxPoints: 20, status: renewalScore >= 15 ? "good" : renewalScore >= 10 ? "warning" : "critical" },
      { category: "Collections", points: arrearsTotalScore, maxPoints: 10, status: arrearsTotalScore >= 8 ? "good" : arrearsTotalScore >= 5 ? "warning" : "critical" },
    ],
    tenantConcentration: concentration,
  };
}
