// lib/property-operations/inspections/inspection.types.ts
// Inspection Type Definitions

export type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type InspectionType = 'routine' | 'compliance' | 'insurance' | 'handover' | 'quarterly' | 'annual';

export interface InspectionChecklistItem {
  id: string;
  item: string;
  passed: boolean;
  notes?: string;
  photo_url?: string;
}

export interface Inspection {
  id: string;
  entity_id?: string;
  property_id: string;
  asset_id?: string;
  unit_id?: string;
  title: string;
  type: InspectionType;
  scheduled_date: string;
  completed_date?: string;
  inspector?: string;
  inspector_company?: string;
  checklist: InspectionChecklistItem[];
  findings?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  report_url?: string;
  photos?: string[];
  status: InspectionStatus;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateInspectionParams {
  property_id: string;
  asset_id?: string;
  unit_id?: string;
  title: string;
  type: InspectionType;
  scheduled_date: string;
  inspector?: string;
  inspector_company?: string;
  checklist?: InspectionChecklistItem[];
}

export interface UpdateInspectionParams {
  title?: string;
  type?: InspectionType;
  scheduled_date?: string;
  completed_date?: string;
  inspector?: string;
  inspector_company?: string;
  checklist?: InspectionChecklistItem[];
  findings?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  report_url?: string;
  photos?: string[];
  status?: InspectionStatus;
}
