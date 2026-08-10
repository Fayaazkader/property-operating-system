// lib/inspections/contracts/v1/dashboard.ts

export interface InspectionSummary {
  total: number; upcoming: number; overdue: number; completedThisMonth: number;
  highRiskFindings: number; complianceRate: number;
}

export interface InspectionDashboard {
  summary: InspectionSummary;
  overdue: Array<{ id: string; title: string; scheduled_date: string; type: string }>;
  upcoming: Array<{ id: string; title: string; scheduled_date: string; type: string; inspector: string }>;
  categories: Array<{ category: string; rate: number }>;
}
