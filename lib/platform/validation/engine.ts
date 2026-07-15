// lib/platform/validation/engine.ts
// Validation Engine — Platform Service

import { ValidationRule, ValidationResult, ValidationContext, ValidationIssue, Reminder, Escalation } from './types';
import { logger } from '../events/logger.service';
import { settingsEngine } from '../settings/engine';

export class ValidationEngine {
  private rules: Map<string, ValidationRule[]> = new Map();

  registerRules(domain: string, rules: ValidationRule[]): void {
    this.rules.set(domain, rules);
    logger.info(`📋 Registered ${rules.length} validation rules for ${domain}`);
  }

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const domainRules = this.rules.get(context.domain) || [];
    
    const critical: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const recommendations: ValidationIssue[] = [];
    const approvalRoles: string[] = [];
    const reminders: Reminder[] = [];
    const escalations: Escalation[] = [];

    for (const rule of domainRules) {
      if (!rule.is_active) continue;

      const passed = this.evaluateRule(rule, context.data);

      const issue: ValidationIssue = {
        rule_id: rule.id,
        field: rule.field,
        label: rule.label,
        message: rule.message,
        severity: rule.severity,
        data: context.data[rule.field],
      };

      if (!passed) {
        if (rule.severity === 'critical') {
          critical.push(issue);
        } else if (rule.severity === 'warning') {
          warnings.push(issue);
        } else {
          recommendations.push(issue);
        }

        if (rule.requires_approval && rule.approval_role) {
          approvalRoles.push(rule.approval_role);
        }

        if (rule.reminder_days) {
          reminders.push({
            days: rule.reminder_days,
            message: `Reminder: ${rule.message}`,
            recipients: [context.user_id],
          });
        }

        if (rule.escalation_days && rule.escalation_role) {
          escalations.push({
            days: rule.escalation_days,
            role: rule.escalation_role,
            message: `Escalation: ${rule.message}`,
          });
        }
      }
    }

    const totalRules = domainRules.filter(r => r.is_active).length;
    const passedRules = totalRules - critical.length - warnings.length - recommendations.length;
    const score = totalRules > 0 ? Math.round((passedRules / totalRules) * 100) : 100;

    return {
      passed: critical.length === 0,
      score,
      critical,
      warnings,
      recommendations,
      requires_approval: approvalRoles.length > 0,
      approval_roles: [...new Set(approvalRoles)],
      reminders,
      escalations,
    };
  }

  private evaluateRule(rule: ValidationRule, data: any): boolean {
    const value = data[rule.field];

    if (value === undefined || value === null) {
      return rule.operator === 'is_empty' || rule.operator === 'is_not_empty';
    }

    switch (rule.operator) {
      case 'eq':
        return value === rule.value;
      case 'neq':
        return value !== rule.value;
      case 'gt':
        return value > rule.value;
      case 'gte':
        return value >= rule.value;
      case 'lt':
        return value < rule.value;
      case 'lte':
        return value <= rule.value;
      case 'contains':
        return String(value).includes(String(rule.value));
      case 'not_contains':
        return !String(value).includes(String(rule.value));
      case 'starts_with':
        return String(value).startsWith(String(rule.value));
      case 'ends_with':
        return String(value).endsWith(String(rule.value));
      case 'is_empty':
        return value === '' || value === null || value === undefined;
      case 'is_not_empty':
        return value !== '' && value !== null && value !== undefined;
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
      case 'phone':
        return /^[\+\d\s\-\(\)]{10,20}$/.test(String(value));
      case 'url':
        try { new URL(String(value)); return true; } catch { return false; }
      case 'uuid':
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));
      case 'regex':
        if (!rule.value) return true;
        try { return new RegExp(String(rule.value)).test(String(value)); } catch { return true; }
      case 'custom':
        if (rule.custom_fn) return rule.custom_fn(data);
        return true;
      default:
        return true;
    }
  }

  getRules(domain: string): ValidationRule[] {
    return this.rules.get(domain) || [];
  }

  getRule(domain: string, ruleId: string): ValidationRule | undefined {
    const rules = this.rules.get(domain) || [];
    return rules.find(r => r.id === ruleId);
  }

  updateRule(domain: string, ruleId: string, updates: Partial<ValidationRule>): void {
    const rules = this.rules.get(domain) || [];
    const index = rules.findIndex(r => r.id === ruleId);
    if (index === -1) return;
    rules[index] = { ...rules[index], ...updates };
    this.rules.set(domain, rules);
  }
}

export const validationEngine = new ValidationEngine();
