// lib/platform/automation/types.ts
// Automation Platform Types — Production Grade

export type TriggerType = 'event' | 'schedule' | 'condition_met';
export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in' | 'exists' | 'not_exists';
export type ActionType = 'publish_event' | 'create_task' | 'create_work_order' | 'send_notification' | 'update_entity' | 'call_webhook';
export type RuleStatus = 'active' | 'paused' | 'draft' | 'archived';
export type FailurePolicy = 'retry' | 'escalate' | 'ignore' | 'stop' | 'continue';

export interface AutomationCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
}

export interface AutomationAction {
  type: ActionType;
  config: Record<string, any>;
}

export interface AutomationRule {
  id: string;
  entity_id: string;
  name: string;
  description: string;
  trigger: TriggerType;
  trigger_config: {
    event?: string;
    cron?: string;
    entity_type?: string;
  };
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  status: RuleStatus;
  priority: number;
  cooldown_seconds?: number;
  failure_policy: FailurePolicy;
  last_triggered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationExecutionContext {
  rule: AutomationRule;
  event?: any;
  correlationId: string;
  triggeredAt: string;
}

export interface ConditionResult {
  passed: boolean;
  field: string;
  operator: ConditionOperator;
  expected: any;
  actual: any;
}

export interface ActionResult {
  success: boolean;
  action: AutomationAction;
  result?: any;
  error?: string;
}

export interface ExecutionLogEntry {
  id?: string;
  rule_id: string;
  entity_id: string;
  event_name: string;
  correlation_id: string;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  conditions_result?: ConditionResult[];
  actions_result?: ActionResult[];
  error?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
}
