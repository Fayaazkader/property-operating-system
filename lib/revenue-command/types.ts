// lib/revenue-command/types.ts

export interface TenantRevenueProfile {
  tenant_id: string;
  entity_id: string;
  property_id?: string;
  industry?: string;
  tenant_type?: string;
  years_as_tenant?: number;
  avg_payment_day?: number;
  avg_delay_days?: number;
  collection_confidence?: number;
  seasonal_pattern?: Record<string, number>;
  payment_trend?: string;
  preferred_channel?: string;
  avg_response_time_minutes?: number;
  reminder_effectiveness?: number;
  contact_reliability?: number;
  disputes_raised?: number;
  promise_keeping_rate?: number;
  deposit_usage_count?: number;
  maintenance_trend?: string;
  utility_trend?: string;
  assigned_playbook?: string;
  lease_behaviour?: Record<string, any>;
  property_behaviour?: Record<string, any>;
}

export interface RevenueAssuranceScore {
  lease_id: string;
  overall_score: number;
  current_risk: number;
  future_risk: number;
  recoverability: number;
  collection_confidence: number;
  revenue_protected: number;
  payment_reliability: number;
  behaviour_stability: number;
  communication_score: number;
  financial_health: number;
  compliance_score: number;
  trend: string;
  explanation: Record<string, any>;
  recommended_action?: string;
  action_urgency?: string;
}

export interface RevenueDigitalTwin {
  lease_id: string;
  expected_collection?: number;
  collection_confidence?: number;
  revenue_risk?: string;
  behaviour_trend?: string;
  recommended_action?: string;
  next_expected_event?: string;
  next_expected_date?: string;
  legal_monthly_rent?: number;
}

export interface RevenuePlaybook {
  id: string;
  entity_id: string;
  name: string;
  description?: string;
  steps: PlaybookStep[];
}

export interface PlaybookStep {
  action: string;
  channel?: string;
  timing: string;
  condition?: string;
}

export interface PaymentCommitment {
  id: string;
  lease_id: string;
  tenant_id: string;
  committed_amount: number;
  committed_date: string;
  actual_payment_date?: string;
  actual_amount?: number;
  status: string;
}

export interface RevenueOutlook {
  expected_today: number;
  collected_today: number;
  still_expected: number;
  at_risk: number;
  collection_confidence: number;
  top_priorities: Array<{
    lease_id: string;
    tenant_name: string;
    amount: number;
    risk: string;
    action: string;
  }>;
}

export interface RevenueDecision {
  id: string;
  entity_id: string;
  lease_id: string;
  tenant_id: string;
  decision_type: string;
  confidence: number;
  signals_considered: string[];
  chosen_action: string;
  alternative_actions: string[];
  executed: boolean;
  executed_at?: string;
  outcome?: string;
}

export interface RevenueStrategy {
  id: string;
  entity_id: string;
  goal_name: string;
  target_value: number;
  current_value: number;
  unit: string;
  owner?: string;
  status: string;
  review_frequency: string;
  deadline?: string;
}

export interface RevenueOpportunity {
  lease_id: string;
  tenant_name: string;
  opportunity_type: string;
  description: string;
  potential_value: number;
  probability: number;
  expected_value: number;
  confidence: number;
  required_effort: string;
  action: string;
}

export interface RevenueActivityEvent {
  id: string;
  entity_id: string;
  reference_type: string;
  reference_id: string;
  signal_category: string;
  event_type: string;
  description?: string;
  metadata?: Record<string, any>;
  occurred_at: string;
}

export type SignalCategory = 'financial' | 'behaviour' | 'communication' | 'legal' | 'operational' | 'external';
