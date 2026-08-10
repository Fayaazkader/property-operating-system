// lib/procurement/types.ts

export type SpendRequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type RFQStatus = 'draft' | 'issued' | 'received' | 'evaluated';
export type POStatus = 'draft' | 'issued' | 'partially_received' | 'received' | 'cancelled';
export type InvoiceMatchStatus = 'pending' | 'matched' | 'variance' | 'disputed' | 'approved';

export interface SpendRequest {
  id: string; entity_id: string; property_id: string;
  title: string; description?: string; estimated_amount: number;
  category: string; priority: string; status: SpendRequestStatus;
  requested_by: string; approved_by?: string;
  created_at: string; updated_at: string;
}

export interface RFQ {
  id: string; entity_id: string; spend_request_id: string;
  title: string; description?: string; supplier_ids: string[];
  status: RFQStatus; issued_at?: string; closed_at?: string;
  created_at: string;
}

export interface Quote {
  id: string; rfq_id: string; supplier_id: string;
  amount: number; description?: string; status: string;
  submitted_at: string;
}

export interface PurchaseOrder {
  id: string; entity_id: string; spend_request_id: string;
  supplier_id: string; quote_id?: string; amount: number;
  status: POStatus; issued_at?: string; received_at?: string;
  created_at: string;
}

export interface GoodsReceipt {
  id: string; po_id: string; received_by: string;
  quantity: number; notes?: string; received_at: string;
}

export interface SupplierInvoice {
  id: string; po_id: string; supplier_id: string;
  invoice_number: string; amount: number;
  match_status: InvoiceMatchStatus; created_at: string;
}
