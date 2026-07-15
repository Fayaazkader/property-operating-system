// lib/platform/events/events.ts
// Central catalogue of all event names — use these everywhere, never string literals

export const Events = {
  // Platform
  Notification: {
    Requested: 'notification.requested',
    Sent: 'notification.sent',
    Delivered: 'notification.delivered',
    Failed: 'notification.failed',
  },
  // Lease
  Lease: {
    Executed: 'lease.executed',
    Activated: 'lease.activated',
    Expiring: 'lease.expiring',
    Renewed: 'lease.renewed',
  },
  // Financial
  Statement: {
    Generated: 'statement.generated',
    Viewed: 'statement.viewed',
  },
  Payment: {
    Received: 'payment.received',
    Allocated: 'payment.allocated',
    Failed: 'payment.failed',
  },
  // Maintenance
  Maintenance: {
    Requested: 'maintenance.requested',
    Assigned: 'maintenance.assigned',
    Completed: 'maintenance.completed',
  },
  // Portfolio
  Portfolio: {
    Updated: 'portfolio.updated',
    Reported: 'portfolio.reported',
  },
  // Conversation
  Conversation: {
    MessageProcessed: 'conversation.message.processed',
    IntentResolved: 'conversation.intent.resolved',
    Escalated: 'conversation.escalated',
  },
  // WhatsApp
  WhatsApp: {
    MessageReceived: 'whatsapp.message.received',
    MessageSent: 'whatsapp.message.sent',
    MessageRead: 'whatsapp.message.read',
  },
  // Vacancy
  Vacancy: {
    Created: 'vacancy.created',
    Assigned: 'vacancy.assigned',
    Converted: 'vacancy.converted',
    Closed: 'vacancy.closed',
  },
  // Broker
  Broker: {
    Created: 'broker.created',
    Updated: 'broker.updated',
    Archived: 'broker.archived',
    MandateCreated: 'broker.mandate.created',
    MandateAccepted: 'broker.mandate.accepted',
    MandateDeclined: 'broker.mandate.declined',
    MandateCompleted: 'broker.mandate.completed',
    OfferReceived: 'broker.offer.received',
    OfferAccepted: 'broker.offer.accepted',
    OfferDeclined: 'broker.offer.declined',
    CommissionCalculated: 'broker.commission.calculated',
    CommissionApproved: 'broker.commission.approved',
    CommissionPaymentRequested: 'broker.commission.payment_requested',
    CommissionDeclined: 'broker.commission.declined',
    NegotiationRoundAdded: 'broker.negotiation.round.added',
  },
  // Work Order
  WorkOrder: {
    Created: 'work.order.created',
    Assigned: 'work.order.assigned',
    Completed: 'work.order.completed',
    SLABreached: 'work.order.sla.breached',
  },
  // Inspection
  Inspection: {
    Created: 'inspection.created',
    Completed: 'inspection.completed',
  },
  // Supplier
  Supplier: {
    Created: 'supplier.created',
    Updated: 'supplier.updated',
  },
  // Purchase Order
  PurchaseOrder: {
    Created: 'purchase.order.created',
    Approved: 'purchase.order.approved',
    Completed: 'purchase.order.completed',
  },
  // Compliance
  Compliance: {
    Created: 'compliance.item.created',
    Renewed: 'compliance.item.renewed',
    Expiring: 'compliance.item.expiring',
    Expired: 'compliance.item.expired',
  },
  // Approval
  Approval: {
    RequestCreated: 'approval.request.created',
    RequestApproved: 'approval.request.approved',
    RequestRejected: 'approval.request.rejected',
  },
  // Property Operations
  Property: {
    AssetCreated: 'property.asset.created',
    AssetUpdated: 'property.asset.updated',
    AssetServiced: 'property.asset.serviced',
    ContractCreated: 'property.contract.created',
    ContractUpdated: 'property.contract.updated',
    WorkOrderCreated: 'property.work_order.created',
    WorkOrderCompleted: 'property.work_order.completed',
    WorkOrderSLABreached: 'property.work_order.sla.breached',
    InspectionCreated: 'property.inspection.created',
    InspectionCompleted: 'property.inspection.completed',
    SupplierCreated: 'property.supplier.created',
    SupplierUpdated: 'property.supplier.updated',
    POApproved: 'property.po.approved',
    ComplianceExpiring: 'property.compliance.expiring',
    ComplianceExpired: 'property.compliance.expired',
  },
  // Orchestration
  System: {
    WorkOrderCreationRequested: 'work.order.creation.requested',
    TaskCreationRequested: 'task.creation.requested',
  },
} as const;

export type EventName = typeof Events[keyof typeof Events];
