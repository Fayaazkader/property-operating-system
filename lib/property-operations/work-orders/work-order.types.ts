// lib/property-operations/work-orders/work-order.types.ts
// Work Order Type Definitions

export type WorkOrderStatus = 
  | 'reported'
  | 'triaged'
  | 'approved'
  | 'quoted'
  | 'assigned'
  | 'accepted'
  | 'scheduled'
  | 'in_progress'
  | 'waiting_parts'
  | 'completed'
  | 'verified'
  | 'closed'
  | 'cancelled';

export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'emergency';
export type WorkOrderSource = 'tenant' | 'inspection' | 'preventative' | 'compliance' | 'other';

export interface WorkOrder {
  id: string;
  entity_id?: string;
  property_id: string;
  unit_id?: string;
  tenant_id?: string;
  asset_id?: string;
  inspection_id?: string;
  title: string;
  description?: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assigned_to?: string;
  assigned_at?: string;
  scheduled_date?: string;
  completed_at?: string;
  estimated_cost?: number;
  actual_cost?: number;
  quoted_amount?: number;
  quotation_url?: string;
  purchase_order_id?: string;
  tenant_notes?: string;
  supplier_notes?: string;
  internal_notes?: string;
  source: WorkOrderSource;
  source_id?: string;
  sla_response_at?: string;
  sla_completed_at?: string;
  sla_breached: boolean;
  tenant_rating?: number;
  tenant_feedback?: string;
  photos?: string[];
  attachments?: string[];
  timeline: any[];
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreateWorkOrderParams {
  property_id: string;
  unit_id?: string;
  tenant_id?: string;
  asset_id?: string;
  inspection_id?: string;
  title: string;
  description?: string;
  priority?: WorkOrderPriority;
  assigned_to?: string;
  source?: WorkOrderSource;
  source_id?: string;
  estimated_cost?: number;
  tenant_notes?: string;
}

export interface UpdateWorkOrderParams {
  title?: string;
  description?: string;
  priority?: WorkOrderPriority;
  status?: WorkOrderStatus;
  assigned_to?: string;
  assigned_at?: string;
  scheduled_date?: string;
  completed_at?: string;
  estimated_cost?: number;
  actual_cost?: number;
  quoted_amount?: number;
  quotation_url?: string;
  purchase_order_id?: string;
  tenant_notes?: string;
  supplier_notes?: string;
  internal_notes?: string;
  sla_response_at?: string;
  sla_completed_at?: string;
  sla_breached?: boolean;
  tenant_rating?: number;
  tenant_feedback?: string;
  photos?: string[];
  attachments?: string[];
}
