import { supabase } from '@/lib/supabase';

export interface ValidationResult {
  passed: boolean;
  isBlocking: boolean;
  checks: Array<{ check: string; passed: boolean; message: string; blocking: boolean }>;
}

export class ValidationService {
  async validate(context: {
    tenantName: string;
    vatNumber: string;
    unitId: string;
    propertyId: string;
    leaseStart: string;
    leaseEnd: string;
    entityId: string;
  }): Promise<ValidationResult> {
    const checks: ValidationResult['checks'] = [];

    const { data: existingTenant } = await supabase.from('tenants').select('id').eq('vat_number', context.vatNumber).single();
    checks.push({ check: 'Tenant unique', passed: !existingTenant, message: existingTenant ? 'VAT number already exists — cannot create duplicate' : 'VAT number is unique', blocking: !!existingTenant });

    const { data: unit } = await supabase.from('units').select('occupancy_status').eq('id', context.unitId).single();
    const unitVacant = unit?.occupancy_status === 'Vacant';
    checks.push({ check: 'Unit vacant', passed: unitVacant, message: unitVacant ? 'Unit is available' : 'Unit is occupied — select a vacant unit', blocking: !unitVacant });

    const { data: property } = await supabase.from('properties').select('property_status').eq('id', context.propertyId).single();
    const propertyActive = property?.property_status === 'active';
    checks.push({ check: 'Property active', passed: propertyActive, message: propertyActive ? 'Property is active' : 'Property is not active', blocking: !propertyActive });

    const startDate = new Date(context.leaseStart);
    const endDate = new Date(context.leaseEnd);
    const datesValid = endDate > startDate;
    checks.push({ check: 'Lease dates valid', passed: datesValid, message: datesValid ? 'Dates are valid' : 'End date must be after start date', blocking: !datesValid });

    return { passed: checks.every(c => c.passed), isBlocking: checks.some(c => !c.passed && c.blocking), checks };
  }
}

export const validationService = new ValidationService();
