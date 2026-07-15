// lib/platform/validation/types.ts
// Validation Engine Type Definitions

export type ValidationSeverity = 'critical' | 'warning' | 'recommendation';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  domain: string;
  severity: ValidationSeverity;
  field: string;
  label: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty' | 'regex' | 'email' | 'phone' | 'url' | 'uuid' | 'custom';
  value?: any;
  custom_fn?: (data: any) => boolean;
  message: string;
  requires_approval: boolean;
  approval_role?: string;
  reminder_days?: number;
  escalation_days?: number;
  escalation_role?: string;
  is_active: boolean;
  priority: number;
}

export interface ValidationResult {
  passed: boolean;
  score: number;
  critical: ValidationIssue[];
  warnings: ValidationIssue[];
  recommendations: ValidationIssue[];
  requires_approval: boolean;
  approval_roles: string[];
  reminders: Reminder[];
  escalations: Escalation[];
}

export interface ValidationIssue {
  rule_id: string;
  field: string;
  label: string;
  message: string;
  severity: ValidationSeverity;
  data?: any;
}

export interface Reminder {
  days: number;
  message: string;
  recipients: string[];
}

export interface Escalation {
  days: number;
  role: string;
  message: string;
}

export interface ValidationContext {
  entity_id: string;
  domain: string;
  user_id: string;
  data: Record<string, any>;
  existing?: Record<string, any>;
}
