import type { LeaseData } from './types';

export const leaseValidators = {
  validateRequired(data: LeaseData): string[] {
    const errors: string[] = [];
    if (!data.tenant_id) errors.push('Tenant is required');
    if (!data.property_id) errors.push('Property is required');
    if (!data.monthly_rental || data.monthly_rental <= 0) errors.push('Monthly rental must be greater than 0');
    if (data.commencement_date && data.expiry_date && new Date(data.commencement_date) >= new Date(data.expiry_date)) {
      errors.push('Commencement date must be before expiry date');
    }
    return errors;
  },

  validateUnitAvailable(activeExists: boolean): string | null {
    return activeExists ? 'Unit already has an active lease' : null;
  }
};
