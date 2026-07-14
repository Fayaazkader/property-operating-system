// lib/property-operations/types.ts
// Property Operations Type Definitions

// ============================================================
// ASSET TYPES
// ============================================================

export type AssetStatus = 
  | 'commissioned'
  | 'operational'
  | 'scheduled_maintenance'
  | 'fault'
  | 'repair'
  | 'replacement_approved'
  | 'retired';

export type AssetType = 
  | 'lift' 
  | 'generator' 
  | 'hvac' 
  | 'fire_panel' 
  | 'pump' 
  | 'roof' 
  | 'access_control' 
  | 'cctv' 
  | 'parking_gate' 
  | 'water_meter' 
  | 'electrical_meter' 
  | 'other';

export interface Asset {
  id: string;
  entity_id?: string;
  property_id: string;
  building_id?: string;
  floor?: string;
  zone?: string;
  space?: string;
  name: string;
  type: AssetType;
  serial_number?: string;
  model?: string;
  manufacturer?: string;
  installation_date?: string;
  warranty_expiry?: string;
  expected_life_years?: number;
  replacement_value?: number;
  service_interval_days?: number;
  last_service_date?: string;
  next_service_date?: string;
  service_notes?: string;
  preferred_supplier_id?: string;
  manual_url?: string;
  photos?: string[];
  status: AssetStatus;
  location_notes?: string;
  // Timeline
  timeline: AssetTimelineEntry[];
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface AssetTimelineEntry {
  id: string;
  asset_id: string;
  event: string;
  description: string;
  date: string;
  created_by?: string;
}

export interface CreateAssetParams {
  property_id: string;
  building_id?: string;
  floor?: string;
  zone?: string;
  space?: string;
  name: string;
  type: AssetType;
  serial_number?: string;
  model?: string;
  manufacturer?: string;
  installation_date?: string;
  warranty_expiry?: string;
  expected_life_years?: number;
  replacement_value?: number;
  service_interval_days?: number;
  preferred_supplier_id?: string;
  location_notes?: string;
}

export interface UpdateAssetParams {
  name?: string;
  type?: AssetType;
  serial_number?: string;
  model?: string;
  manufacturer?: string;
  installation_date?: string;
  warranty_expiry?: string;
  expected_life_years?: number;
  replacement_value?: number;
  service_interval_days?: number;
  last_service_date?: string;
  service_notes?: string;
  preferred_supplier_id?: string;
  status?: AssetStatus;
  floor?: string;
  zone?: string;
  space?: string;
  location_notes?: string;
}

// ============================================================
// CONTRACT TYPES
// ============================================================

export type ContractStatus = 'active' | 'paused' | 'expired' | 'cancelled';
export type ContractFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'bi_annual' | 'annual';

export interface ServiceContract {
  id: string;
  entity_id?: string;
  property_id?: string;
  asset_id?: string;
  supplier_id?: string;
  title: string;
  description?: string;
  service_type: string;
  frequency: ContractFrequency;
  frequency_days?: number;
  start_date: string;
  end_date?: string;
  last_service_date?: string;
  next_service_date?: string;
  last_generated_work_order_id?: string;
  sla_response_hours: number;
  sla_completion_days: number;
  contract_value?: number;
  status: ContractStatus;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateContractParams {
  property_id?: string;
  asset_id?: string;
  supplier_id?: string;
  title: string;
  description?: string;
  service_type: string;
  frequency: ContractFrequency;
  frequency_days?: number;
  start_date: string;
  end_date?: string;
  sla_response_hours?: number;
  sla_completion_days?: number;
  contract_value?: number;
}

// ============================================================
// TIMELINE TYPES
// ============================================================

export interface PropertyTimelineEntry {
  id: string;
  entity_id: string;
  property_id: string;
  event_type: string;
  title: string;
  description?: string;
  reference_id?: string;
  reference_type?: string;
  source: string;
  created_at: string;
  created_by?: string;
}
