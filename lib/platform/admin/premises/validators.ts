import type { UnitData, Unit } from './types';

export const premisesValidators = {
  validateAll(data: UnitData, propertyGLA: number, existingGLA: number, existingUnits: Unit[]): string[] {
    const errors: string[] = [];
    
    const glaError = this.validateGLA(data.gla_sqm, propertyGLA, existingGLA);
    if (glaError) errors.push(glaError);
    
    const unitNumberError = this.validateUnitNumber(data.unit_number, existingUnits.map(u => u.unit_number));
    if (unitNumberError) errors.push(unitNumberError);
    
    return errors;
  },

  validateGLA(gla: number | undefined, propertyGLA: number, existingUnitsGLA: number): string | null {
    if (gla !== undefined && gla <= 0) return 'GLA must be greater than 0';
    if (gla && propertyGLA > 0 && (existingUnitsGLA + gla) > propertyGLA) {
      return `Total unit GLA (${existingUnitsGLA + gla}m²) exceeds property GLA (${propertyGLA}m²)`;
    }
    return null;
  },

  validateUnitNumber(unitNumber: string, existingNumbers: string[]): string | null {
    if (!unitNumber.trim()) return 'Unit number is required';
    if (existingNumbers.includes(unitNumber)) return `Unit ${unitNumber} already exists in this property`;
    return null;
  },

  validateOccupancy(status: string): string | null {
    const valid = ['Vacant', 'Reserved', 'Occupied', 'Under Maintenance'];
    if (!valid.includes(status)) return `Invalid occupancy status: ${status}`;
    return null;
  },

  validateOperational(status: string): string | null {
    const valid = ['Active', 'Under Renovation', 'Decommissioned', 'Held'];
    if (!valid.includes(status)) return `Invalid operational status: ${status}`;
    return null;
  }
};

/*
 * All validators are PURE FUNCTIONS.
 * They receive all data as arguments, never perform I/O.
 * This makes them independently testable without mocking.
 */
