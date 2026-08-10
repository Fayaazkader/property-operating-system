// lib/financial/contracts.ts — Utilities & Recoveries contracts

export interface RecoverySummary {
  totalBudgeted: number; totalActual: number; totalRecovered: number;
  recoveryRate: number; leakageCount: number; leakageAmount: number;
  readyForBilling: number;
}

export interface RecoveryDashboard {
  summary: RecoverySummary;
  leakageItems: Array<{ id: string; property: string; category: string; rate: number; unrecovered: number }>;
  pipeline: Array<{ stage: string; label: string; count: number }>;
}
