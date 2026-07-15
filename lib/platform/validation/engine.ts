// lib/platform/validation/engine.ts
// Validation Engine — Platform Service

import { ValidationRule, ValidationResult, ValidationContext, ValidationIssue, Reminder, Escalation } from './types';
import { logger } from '../events/logger.service';
import { settingsEngine } from '../settings/engine';

export class ValidationEngine {
  private rules: Map<string, ValidationRule[]> = new Map();

  // ============================================================
  // REGISTER RULES
  // ============================================================

  registerRules(domain: string, rules: ValidationRule[]): void {
    this.rules.set(domain, rules);
    logger.info(`📋 Registered ${rules.length} validation rules for ${domain}`);
  }

  // ============================================================
  // VALIDATE
  // ============================================================

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const domainRules = this.rules.get(context.domain) || [];
    const entitySettings = await settingsEngine.getSettings(context.entity_id);
    
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

    // Calculate score (percentage of rules passed)
    const totalRules = domainRules.filter(r => r.is_active).length;
    const passedRules = totalRules - critical.length - warnings.length - recommendations.length;
    const score = totalRules > 0 ? Math.round((passedRules / totalRules) * 100) : 100;

    const passed = critical.length === 0;

    return {
      passed,
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

  // ============================================================
  // EVALUATE RULE
  // ============================================================

  private evaluateRule(rule: ValidationRule, data: any): boolean {
    const value = data[rule.field];

    // Skip if value is undefined/null and not checking for empty
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

  // ============================================================
  // GET RULES
  // ============================================================

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

  // ============================================================
  // DOMAIN-SPECIFIC VALIDATION HELPERS
  // ============================================================

  getLeaseValidationRules(): ValidationRule[] {
    return [
      {
        id: 'lease.tenant_id',
        name: 'Tenant Required',
        description: 'A tenant must be selected for the lease',
        domain: 'lease',
        severity: 'critical',
        field: 'tenant_id',
        label: 'Tenant',
        operator: 'is_not_empty',
        message: 'A tenant is required for this lease',
        requires_approval: false,
        is_active: true,
        priority: 1,
      },
      {
        id: 'lease.property_id',
        name: 'Property Required',
        description: 'A property must be selected for the lease',
        domain: 'lease',
        severity: 'critical',
        field: 'property_id',
        label: 'Property',
        operator: 'is_not_empty',
        message: 'A property is required for this lease',
        requires_approval: false,
        is_active: true,
        priority: 1,
      },
      {
        id: 'lease.monthly_rental',
        name: 'Monthly Rental Required',
        description: 'The monthly rental amount must be set',
        domain: 'lease',
        severity: 'critical',
        field: 'monthly_rental',
        label: 'Monthly Rental',
        operator: 'gt',
        value: 0,
        message: 'The monthly rental amount must be greater than R0',
        requires_approval: false,
        is_active: true,
        priority: 1,
      },
      {
        id: 'lease.deposit_amount',
        name: 'Deposit Required',
        description: 'A deposit amount must be set',
        domain: 'lease',
        severity: 'critical',
        field: 'deposit_amount',
        label: 'Deposit',
        operator: 'gt',
        value: 0,
        message: 'A deposit amount is required for this lease',
        requires_approval: false,
        is_active: true,
        priority: 1,
      },
      {
        id: 'lease.contact_email',
        name: 'Contact Email',
        description: 'The contact email should be valid',
        domain: 'lease',
        severity: 'warning',
        field: 'contact_email',
        label: 'Contact Email',
        operator: 'email',
        message: 'The contact email should be a valid email address',
        requires_approval: false,
        is_active: true,
        priority: 2,
      },
      {
        id: 'lease.contact_phone',
        name: 'Contact Phone',
        description: 'The contact phone should be valid',
        domain: 'lease',
        severity: 'warning',
        field: 'contact_phone',
        label: 'Contact Phone',
        operator: 'phone',
        message: 'The contact phone should be a valid phone number',
        requires_approval: false,
        is_active: true,
        priority: 2,
      },
      {
        id: 'lease.company_registration',
        name: 'Company Registration',
        description: 'Company registration is recommended',
        domain: 'lease',
        severity: 'recommendation',
        field: 'company_registration',
        label: 'Company Registration',
        operator: 'is_not_empty',
        message: 'Company registration is recommended',
        requires_approval: false,
        is_active: true,
        priority: 3,
      },
      {
        id: 'lease.fica_verified',
        name: 'FICA Verification',
        description: 'Tenant FICA verification is recommended',
        domain: 'lease',
        severity: 'recommendation',
        field: 'tenant_id',
        label: 'FICA Status',
        operator: 'custom',
        custom_fn: (data) => {
          // This would check if the tenant's FICA is verified
          return true; // Placeholder
        },
        message: 'Tenant FICA verification is recommended before activation',
        requires_approval: false,
        is_active: true,
        priority: 3,
      },
    ];
  }

  getSupplierValidationRules(): ValidationRule[] {
    return [
      {
        id: 'supplier.name',
        name: 'Supplier Name Required',
        description: 'A name is required for the supplier',
        domain: 'supplier',
        severity: 'critical',
        field: 'name',
        label: 'Name',
        operator: 'is_not_empty',
        message: 'A supplier name is required',
        requires_approval: false,
        is_active: true,
        priority: 1,
      },
      {
        id: 'supplier.registration_number',
        name: 'Registration Number',
        description: 'Registration number is recommended',
        domain: 'supplier',
        severity: 'recommendation',
        field: 'registration_number',
        label: 'Registration Number',
        operator: 'is_not_empty',
        message: 'Supplier registration number is recommended',
        requires_approval: false,
        is_active: true,
        priority: 2,
      },
      {
        id: 'supplier.insurance_verified',
        name: 'Insurance Required',
        description: 'Valid insurance is required for suppliers',
        domain: 'supplier',
        severity: 'warning',
        field: 'insurance_verified',
        label: 'Insurance Status',
        operator: 'eq',
        value: true,
        message: 'Supplier insurance verification is required before payment',
        requires_approval: false,
        is_active: true,
        priority: 2,
      },
      {
        id: 'supplier.fica_verified',
        name: 'FICA Required',
        description: 'FICA verification is required for payment',
        domain: 'supplier',
        severity: 'critical',
        field: 'fica_verified',
        label: 'FICA Status',
        operator: 'eq',
        value: true,
        message: 'FICA verification is required before payment',
        requires_approval: true,
        approval_role: 'finance',
        is_active: true,
        priority: 1,
      },
      {
        id: 'supplier.bank_details',
        name: 'Bank Details',
        description: 'Bank details are required for payment',
        domain: 'supplier',
        severity: 'critical',
        field: 'bank_account_number',
        label: 'Bank Account',
        operator: 'is_not_empty',
        message: 'Bank details are required for payment processing',
        requires_approval: false,
        reminder_days: 7,
        is_active: true,
        priority: 1,
      },
    ];
  }

  getWorkOrderValidationRules(): ValidationRule[] {
    return [
      {
        id: 'work_order.title',
        name: 'Title Required',
        description: 'A title is required for the work order',
        domain: 'work_order',
        severity: 'critical',
        field: 'title',
        label: 'Title',
        operator: 'is_not_empty',
        message: 'A work order title is required',
        requires_approval: false,
        is_active: true,
        priority: 1,
      },
      {
        id: 'work_order.property',
        name: 'Property Required',
        description: 'A property is required for the work order',
        domain: 'work_order',
        severity: 'critical',
        field: 'property_id',
        label: 'Property',
        operator: 'is_not_empty',
        message: 'A property is required for this work order',
        requires_approval: false,
        is_active: true,
        priority: 1,
      },
      {
        id: 'work_order.description',
        name: 'Description',
        description: 'A description is recommended',
        domain: 'work_order',
        severity: 'warning',
        field: 'description',
        label: 'Description',
        operator: 'is_not_empty',
        message: 'A description is recommended',
        requires_approval: false,
        is_active: true,
        priority: 2,
      },
      {
        id: 'work_order.priority',
        name: 'Priority',
        description: 'Priority must be set',
        domain: 'work_order',
        severity: 'critical',
        field: 'priority',
        label: 'Priority',
        operator: 'is_not_empty',
        message: 'Work order priority is required',
        requires_approval: false,
        is_active: true,
        priority: 1,
      },
    ];
  }
}

export const validationEngine = new ValidationEngine();
