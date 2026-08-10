// lib/procurement/contracts.ts

export interface ProcurementSummary {
  total: number; pending: number; approved: number;
}

export interface ProcurementDashboard {
  summary: ProcurementSummary;
  requests: Array<{ id: string; title: string; category: string; amount: number; status: string }>;
}
