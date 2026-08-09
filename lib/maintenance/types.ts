// lib/maintenance/types.ts

export type IssueStatus = 'reported' | 'classified' | 'approved' | 'rejected' | 'duplicate' | 'in_progress' | 'resolved' | 'closed';
export type WorkOrderStatus = 'pending' | 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
export type VisitStatus = 'scheduled' | 'en_route' | 'on_site' | 'completed' | 'no_show';
export type IssuePriority = 'emergency' | 'urgent' | 'routine' | 'scheduled';
export type IssueCategory = 'plumbing' | 'electrical' | 'hvac' | 'structural' | 'waterproofing' | 'fire' | 'lifts' | 'generator' | 'cleaning' | 'pest_control' | 'landscaping' | 'security' | 'other';
export type EntryChannel = 'whatsapp' | 'email' | 'portal' | 'phone' | 'manual' | 'api';

export interface MaintenanceIssue {
  id: string;
  entity_id: string;
  property_id: string;
  unit_id?: string;
  tenant_id?: string;
  lease_id?: string;
  reported_by?: string;
  reported_via: EntryChannel;
  title: string;
  description?: string;
  category?: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
  duplicate_of?: string;
  landlord_responsibility: boolean;
  tenant_approval_required: boolean;
  tenant_approved: boolean;
  tenant_approval_message?: string;
  photo_urls: string[];
}

export interface WorkOrder {
  id: string;
  entity_id: string;
  issue_id: string;
  property_id: string;
  supplier_id?: string;
  title: string;
  description?: string;
  category?: string;
  priority: IssuePriority;
  status: WorkOrderStatus;
  scheduled_date?: string;
  completed_date?: string;
  supplier_cost?: number;
  tenant_chargeable: boolean;
  tenant_charge_amount?: number;
}

export interface SupplierVisit {
  id: string;
  work_order_id: string;
  supplier_id: string;
  scheduled_at?: string;
  arrived_at?: string;
  completed_at?: string;
  status: VisitStatus;
  notes?: string;
  photo_urls: string[];
  tenant_confirmed: boolean;
}

export interface SupplierScore {
  supplier_id: string;
  entity_id: string;
  trade_match: number;
  property_coverage: number;
  emergency_capability: number;
  avg_response_time_hours?: number;
  completion_rate: number;
  quality_rating: number;
  current_workload: number;
  overall_score: number;
}

export interface MaintenanceSchedule {
  id: string;
  entity_id: string;
  property_id: string;
  title: string;
  category: string;
  frequency_months: number;
  last_completed?: string;
  next_due?: string;
  supplier_id?: string;
  auto_generate: boolean;
}

export interface PropertyAsset {
  id: string;
  entity_id: string;
  property_id: string;
  name: string;
  category: string;
  make?: string;
  model?: string;
  serial_number?: string;
  install_date?: string;
  warranty_expiry?: string;
  last_serviced?: string;
  status: string;
}

export interface MaintenanceSLA {
  id: string;
  entity_id: string;
  priority: string;
  response_hours: number;
  arrival_hours: number;
  resolution_hours: number;
}

export interface ApprovalRule {
  id: string;
  entity_id: string;
  rule_name: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  approval_level: string;
}

export interface MaintenanceJournal {
  issue_id: string;
  issue: MaintenanceIssue;
  work_orders: WorkOrder[];
  visits: SupplierVisit[];
  timeline: Array<{ timestamp: string; event: string; detail: string }>;
  sla_status?: { response_deadline: string; arrival_deadline: string; resolution_deadline: string; breached: boolean };
}

export interface PropertyAsset {
  id: string;
  entity_id: string;
  property_id: string;
  name: string;
  category: string;
  make?: string;
  model?: string;
  serial_number?: string;
  install_date?: string;
  warranty_expiry?: string;
  last_serviced?: string;
  status: string;
}

export interface MaintenanceSLA {
  id: string;
  entity_id: string;
  priority: string;
  response_hours: number;
  arrival_hours: number;
  resolution_hours: number;
}

export interface ApprovalRule {
  id: string;
  entity_id: string;
  rule_name: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  approval_level: string;
}

export interface MaintenanceJournal {
  issue_id: string;
  issue: MaintenanceIssue;
  work_orders: WorkOrder[];
  visits: SupplierVisit[];
  timeline: Array<{ timestamp: string; event: string; detail: string }>;
  sla_status?: { response_deadline: string; arrival_deadline: string; resolution_deadline: string; breached: boolean };
}

export interface PropertyAsset {
  id: string;
  entity_id: string;
  property_id: string;
  name: string;
  category: string;
  make?: string;
  model?: string;
  serial_number?: string;
  install_date?: string;
  warranty_expiry?: string;
  last_serviced?: string;
  status: string;
}

export interface MaintenanceSLA {
  id: string;
  entity_id: string;
  priority: string;
  response_hours: number;
  arrival_hours: number;
  resolution_hours: number;
}

export interface ApprovalRule {
  id: string;
  entity_id: string;
  rule_name: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  approval_level: string;
}

export interface MaintenanceJournal {
  issue_id: string;
  issue: MaintenanceIssue;
  work_orders: WorkOrder[];
  visits: SupplierVisit[];
  timeline: Array<{ timestamp: string; event: string; detail: string }>;
  sla_status?: { response_deadline: string; arrival_deadline: string; resolution_deadline: string; breached: boolean };
}
