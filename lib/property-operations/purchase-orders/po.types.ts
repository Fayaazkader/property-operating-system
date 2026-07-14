// lib/property-operations/purchase-orders/po.types.ts
// Purchase Order Type Definitions

export type POStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'completed' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  entity_id?: string;
  work_order_id?: string;
  supplier_id?: string;
  po_number: string;
  description?: string;
  amount?: number;
  status: POStatus;
  issued_date?: string;
  approved_date?: string;
  completed_date?: string;
  approved_by?: string;
  approval_notes?: string;
  po_document_url?: string;
  invoice_url?: string;
  payment_request_id?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CreatePurchaseOrderParams {
  work_order_id?: string;
  supplier_id?: string;
  po_number: string;
  description?: string;
  amount?: number;
}

export interface UpdatePurchaseOrderParams {
  description?: string;
  amount?: number;
  status?: POStatus;
  issued_date?: string;
  approved_date?: string;
  completed_date?: string;
  approved_by?: string;
  approval_notes?: string;
  po_document_url?: string;
  invoice_url?: string;
  payment_request_id?: string;
}
