// lib/platform/documents/validator.ts
import type { ExtractedLeaseFields } from './extraction-engine';

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning' | 'error';
}

export function validateLeaseFields(fields: ExtractedLeaseFields): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Commencement must be before expiry
  if (fields.commencementDate?.value && fields.expiryDate?.value) {
    const start = new Date(fields.commencementDate.value);
    const end = new Date(fields.expiryDate.value);
    if (start >= end) {
      warnings.push({ field: 'dates', message: 'Commencement date must be before expiry date', severity: 'error' });
    }
  }

  // Deposit should be 1-3 months rent
  if (fields.deposit?.value && fields.monthlyRental?.value) {
    const ratio = fields.deposit.value / fields.monthlyRental.value;
    if (ratio < 0.5 || ratio > 6) {
      warnings.push({ field: 'deposit', message: `Deposit (R${fields.deposit.value.toLocaleString()}) seems unusual relative to rent (R${fields.monthlyRental.value.toLocaleString()})`, severity: 'warning' });
    }
  }

  // Rental should be positive and reasonable
  if (fields.monthlyRental?.value && fields.monthlyRental.value > 10000000) {
    warnings.push({ field: 'monthlyRental', message: 'Monthly rental seems unusually high', severity: 'warning' });
  }

  // GLA should be reasonable
  if (fields.glaSqm?.value && (fields.glaSqm.value < 10 || fields.glaSqm.value > 100000)) {
    warnings.push({ field: 'glaSqm', message: 'GLA seems outside normal range', severity: 'warning' });
  }

  return warnings;
}
