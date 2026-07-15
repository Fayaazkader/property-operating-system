// lib/portfolio/types.ts
// Portfolio Intelligence Types — Read-model optimized

export type ReadModelType = 'occupancy' | 'revenue' | 'operations' | 'financial' | 'brokerage' | 'automation' | 'morning_brief' | 'full';

export interface PortfolioMetrics {
  entity_id: string;
  snapshot_date: string;
  occupancy_rate: number;
  total_gla_sqm: number;
  occupied_gla_sqm: number;
  vacant_units: number;
  total_units: number;
  gross_monthly_rental: number;
  gross_annual_rental: number;
  arrears_total: number;
  arrears_rate: number;
  noi: number;
  noi_margin: number;
  open_work_orders: number;
  overdue_work_orders: number;
  inspections_due: number;
  compliance_expiring: number;
  compliance_expired: number;
  payments_awaiting_approval: number;
  payments_due_today: number;
  batches_ready: number;
  active_vacancies: number;
  active_mandates: number;
  commissions_pending: number;
  commissions_pending_value: number;
  active_automations: number;
  automations_triggered_today: number;
}

export interface ReadModel {
  id: string;
  entity_id: string;
  model_type: ReadModelType;
  model_data: Record<string, any>;
  calculated_at: string;
  expires_at: string;
}

export interface PortfolioTrend {
  metric: string;
  current: number;
  previous: number;
  change_pct: number;
  trend: 'up' | 'down' | 'stable';
}

export interface MorningBriefEnrichment {
  greeting: string;
  date: string;
  summary: string;
  attention_items: AttentionItem[];
  today_items: TodayItem[];
  metrics_snapshot: {
    occupancy: string;
    revenue: string;
    arrears: string;
    work_orders: string;
  };
  quick_actions: QuickAction[];
}

export interface AttentionItem {
  id: string;
  type: 'compliance' | 'payment' | 'work_order' | 'lease' | 'commission' | 'mandate';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  link: string;
}

export interface TodayItem {
  id: string;
  type: 'viewing' | 'deadline' | 'payment' | 'inspection' | 'meeting';
  title: string;
  time: string;
  link: string;
}

export interface QuickAction {
  id: string;
  label: string;
  link: string;
  icon: string;
}

export interface AggregationEvent {
  entity_id: string;
  event_type: string;
  event_id: string;
  timestamp: string;
}
