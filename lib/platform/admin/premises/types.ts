export interface Unit {
  id: string;
  unit_code?: string;
  property_id: string;
  unit_number: string;
  unit_name?: string;
  unit_type?: string;
  floor_level?: string;
  gla_sqm?: number;
  rentable_area_sqm?: number;
  occupancy_status?: string;
  operational_status?: string;
  current_rental_rate?: number;
  current_rate_per_sqm?: number;
  current_tenant_name?: string;
  current_lease_id?: string;
  parking_bays?: number;
  utility_meter_reference?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface UnitData {
  property_id: string;
  unit_number: string;
  unit_name?: string;
  unit_type?: string;
  floor_level?: string;
  gla_sqm?: number;
  rentable_area_sqm?: number;
  occupancy_status?: string;
  operational_status?: string;
  parking_bays?: number;
  utility_meter_reference?: string;
  notes?: string;
}

export interface ArchiveIssue {
  code: string;
  count: number;
  label: string;
}

/*
 * current_tenant_name is a DENORMALIZED CACHE.
 * Source of truth: Lease → Tenant → Premises.current_tenant_name
 * DO NOT edit directly. Maintained by LeaseService on activation/termination.
 * DO NOT allow imports to overwrite. UI must never expose an edit field.
 */

/*
 * LIFECYCLE OWNERSHIP:
 * current_lease_id, current_tenant_name, and occupancy_status
 * are owned exclusively by LeaseService.
 * 
 * LeaseService updates these on:
 *   - lease_activated   → sets tenant, marks Occupied
 *   - lease_terminated  → clears tenant, marks Vacant
 * 
 * No other service, UI, or import may modify these fields.
 */
