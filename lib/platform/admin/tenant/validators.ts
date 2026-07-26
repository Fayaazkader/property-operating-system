import type { TenantData } from './types';

export const tenantValidators = {
  validateAll(data: TenantData): string[] {
    return [
      ...this.validateRequired(data),
      ...(data.tenant_type ? [this.validateTenantType(data.tenant_type)].filter(Boolean) as string[] : []),
    ];
  },

  validateRequired(data: TenantData): string[] {
    const errors: string[] = [];
    if (!data.tenant_name?.trim()) errors.push('Tenant name is required');
    if (!data.entity_id) errors.push('Entity is required');
    return errors;
  },

  validateTenantType(type: string): string | null {
    const valid = ['Company', 'Individual', 'Government', 'NPO', 'Trust'];
    return valid.includes(type) ? null : `Invalid tenant type: ${type}`;
  }
};
