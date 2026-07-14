// lib/platform/lifecycle/types.ts
// Lifecycle Types

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface ScheduledJob {
  id: string;
  name: string;
  description: string;
  schedule: string; // cron expression
  handler: () => Promise<JobResult>;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  status?: JobStatus;
}

export interface JobResult {
  success: boolean;
  processed: number;
  created: number;
  failed: number;
  errors?: string[];
  metadata?: Record<string, any>;
}

export interface RuleCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith';
  value: any;
}

export interface RuleAction {
  type: 'create' | 'update' | 'delete' | 'publish_event' | 'notify' | 'execute';
  target: string;
  config: Record<string, any>;
}

export interface LifecycleRule {
  id: string;
  name: string;
  description: string;
  domain: 'vacancy' | 'renewal' | 'inspection' | 'compliance' | 'payment';
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  enabled: boolean;
}

export interface DetectionResult {
  items: any[];
  count: number;
  domain: string;
  timestamp: string;
}

export interface ExecutionResult {
  success: boolean;
  action: string;
  target: string;
  result: any;
  error?: string;
}
