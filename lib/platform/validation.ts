// lib/platform/validation.ts
// Centralized Validation Layer

export interface ValidationRule<T> {
  field: keyof T;
  label: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'uuid';
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
  message?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
}

export function validate<T>(data: T, rules: ValidationRule<T>[]): ValidationResult {
  const errors: { field: string; message: string }[] = [];

  for (const rule of rules) {
    const value = data[rule.field];
    const label = rule.label;

    // Required check
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({ field: String(rule.field), message: `${label} is required` });
      continue;
    }

    // Skip further validation if value is empty and not required
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Type checks
    if (rule.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(value))) {
        errors.push({ field: String(rule.field), message: `${label} must be a valid email` });
      }
    }

    if (rule.type === 'number') {
      if (isNaN(Number(value))) {
        errors.push({ field: String(rule.field), message: `${label} must be a number` });
      }
    }

    if (rule.type === 'uuid') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(String(value))) {
        errors.push({ field: String(rule.field), message: `${label} must be a valid UUID` });
      }
    }

    // Min/Max
    if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
      errors.push({ field: String(rule.field), message: `${label} must be at least ${rule.min}` });
    }

    if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
      errors.push({ field: String(rule.field), message: `${label} must be at most ${rule.max}` });
    }

    // Custom validation
    if (rule.custom && !rule.custom(value)) {
      errors.push({ field: String(rule.field), message: rule.message || `${label} is invalid` });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateRequired<T>(data: T, fields: { field: keyof T; label: string }[]): ValidationResult {
  const rules: ValidationRule<T>[] = fields.map(f => ({
    field: f.field,
    label: f.label,
    required: true,
  }));
  return validate(data, rules);
}
