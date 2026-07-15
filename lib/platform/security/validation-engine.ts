// lib/platform/security/validation-engine.ts
// Validation Engine — Checks data completeness

import { logger } from "../events/logger.service";

export interface ValidationRule {
  field: string;
  label: string;
  required?: boolean;
  type?: 'string' | 'number' | 'date' | 'email' | 'phone' | 'url';
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any, data: Record<string, any>) => boolean;
  message?: string;
}

export interface ValidationResult {
  passed: boolean;
  missing: string[];
  warnings: string[];
  blocking: boolean;
  score: number;
}

export class ValidationEngine {
  validate(data: Record<string, any>, rules: ValidationRule[]): ValidationResult {
    const missing: string[] = [];
    const warnings: string[] = [];
    let blocking = false;

    for (const rule of rules) {
      const value = data[rule.field];
      const label = rule.label;

      // Required check
      if (rule.required && (value === undefined || value === null || value === '')) {
        missing.push(label);
        blocking = true;
        continue;
      }

      // Skip further validation if empty and not required
      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Type checks
      if (rule.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(value))) {
          warnings.push(`${label} should be a valid email`);
        }
      }

      if (rule.type === 'phone') {
        const phoneRegex = /^[\+\d\s\-\(\)]{10,20}$/;
        if (!phoneRegex.test(String(value))) {
          warnings.push(`${label} should be a valid phone number`);
        }
      }

      // Min/Max
      if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
        warnings.push(`${label} should be at least ${rule.min}`);
      }

      if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
        warnings.push(`${label} should be at most ${rule.max}`);
      }

      // Custom validation
      if (rule.custom && !rule.custom(value, data)) {
        warnings.push(rule.message || `${label} is invalid`);
      }
    }

    // Calculate score (percentage of required fields filled)
    const requiredRules = rules.filter(r => r.required);
    const filledRequired = requiredRules.filter(r => {
      const value = data[r.field];
      return value !== undefined && value !== null && value !== '';
    });
    const score = requiredRules.length > 0 
      ? Math.round((filledRequired.length / requiredRules.length) * 100) 
      : 100;

    return {
      passed: !blocking,
      missing,
      warnings,
      blocking,
      score,
    };
  }

  // Pre-built validation rules for common domains
  getLeaseRules(): ValidationRule[] {
    return [
      { field: 'tenant_id', label: 'Tenant', required: true },
      { field: 'property_id', label: 'Property', required: true },
      { field: 'unit_id', label: 'Unit', required: true },
      { field: 'monthly_rental', label: 'Monthly Rental', required: true, type: 'number', min: 0 },
      { field: 'deposit_amount', label: 'Deposit', required: true, type: 'number', min: 0 },
      { field: 'commencement_date', label: 'Commencement Date', required: true },
      { field: 'lease_term_months', label: 'Lease Term', required: true, type: 'number', min: 1 },
      { field: 'applicant_name', label: 'Tenant Name', required: true },
      { field: 'contact_email', label: 'Contact Email', type: 'email' },
      { field: 'contact_phone', label: 'Contact Phone', type: 'phone' },
    ];
  }

  getSupplierRules(): ValidationRule[] {
    return [
      { field: 'name', label: 'Supplier Name', required: true },
      { field: 'email', label: 'Email', type: 'email' },
      { field: 'phone', label: 'Phone', type: 'phone' },
      { field: 'registration_number', label: 'Registration Number' },
      { field: 'vat_number', label: 'VAT Number' },
    ];
  }

  getWorkOrderRules(): ValidationRule[] {
    return [
      { field: 'property_id', label: 'Property', required: true },
      { field: 'title', label: 'Title', required: true },
      { field: 'description', label: 'Description', required: true },
      { field: 'priority', label: 'Priority', required: true },
    ];
  }

  getPaymentRules(): ValidationRule[] {
    return [
      { field: 'amount', label: 'Amount', required: true, type: 'number', min: 0.01 },
      { field: 'supplier_id', label: 'Supplier', required: true },
      { field: 'payment_date', label: 'Payment Date', required: true },
      { field: 'reference', label: 'Reference', required: true },
    ];
  }

  getInspectionRules(): ValidationRule[] {
    return [
      { field: 'property_id', label: 'Property', required: true },
      { field: 'title', label: 'Title', required: true },
      { field: 'type', label: 'Inspection Type', required: true },
      { field: 'scheduled_date', label: 'Scheduled Date', required: true },
    ];
  }
}

export const validationEngine = new ValidationEngine();
