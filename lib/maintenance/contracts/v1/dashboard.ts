// lib/maintenance/contracts/v1/dashboard.ts — Stable DTOs for UI

export interface MaintenanceSummary {
  total: number; open: number; inProgress: number; completed: number; overdue: number;
}

export interface MaintenanceDashboard {
  summary: MaintenanceSummary;
  attention: Array<{ id: string; title: string; priority: string; context: string }>;
  pipeline: Array<{ stage: string; label: string; count: number }>;
}

export interface IssueDetail {
  id: string; title: string; description: string; category: string;
  priority: string; status: string; reported_via: string; created_at: string;
  workOrders: Array<{ id: string; title: string; status: string; supplier_cost: number }>;
  timeline: Array<{ timestamp: string; event: string; detail: string }>;
}
