// lib/platform/events/events.ts
// Central catalogue of all event names

export const Events = {
  Lease: {
    Executed: 'lease.executed',
    Activated: 'lease.activated',
    Expiring: 'lease.expiring',
    Renewed: 'lease.renewed',
  },
  Statement: {
    Generated: 'statement.generated',
    Viewed: 'statement.viewed',
  },
  Payment: {
    Received: 'payment.received',
    Allocated: 'payment.allocated',
    Failed: 'payment.failed',
  },
  Maintenance: {
    Requested: 'maintenance.requested',
    Assigned: 'maintenance.assigned',
    Completed: 'maintenance.completed',
  },
  Portfolio: {
    Updated: 'portfolio.updated',
    Reported: 'portfolio.reported',
  },
  Conversation: {
    MessageProcessed: 'conversation.message.processed',
    IntentResolved: 'conversation.intent.resolved',
    Escalated: 'conversation.escalated',
  },
  WhatsApp: {
    MessageReceived: 'whatsapp.message.received',
    MessageSent: 'whatsapp.message.sent',
    MessageRead: 'whatsapp.message.read',
  },
  Vacancy: {
    Created: 'vacancy.created',
    Assigned: 'vacancy.assigned',
    Converted: 'vacancy.converted',
    Closed: 'vacancy.closed',
  },
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
  WorkOrder: {
    Created: 'work.order.created',
    Completed: 'work.order.completed',
    SLABreached: 'work.order.sla.breached',
  },
  Inspection: {
    Created: 'inspection.created',
    Completed: 'inspection.completed',
  },
  Supplier: {
    Created: 'supplier.created',
    Updated: 'supplier.updated',
  },
  PurchaseOrder: {
    Created: 'purchase.order.created',
    Approved: 'purchase.order.approved',
    Completed: 'purchase.order.completed',
  },
  Compliance: {
    Created: 'compliance.item.created',
    Renewed: 'compliance.item.renewed',
    Expired: 'compliance.item.expired',
  },
  Approval: {
    RequestCreated: 'approval.request.created',
    RequestApproved: 'approval.request.approved',
    RequestRejected: 'approval.request.rejected',
  },
} as const;

export type EventName = typeof Events[keyof typeof Events];
export type LeaseEvent = typeof Events.Lease[keyof typeof Events.Lease];
export type StatementEvent = typeof Events.Statement[keyof typeof Events.Statement];
export type PaymentEvent = typeof Events.Payment[keyof typeof Events.Payment];
export type MaintenanceEvent = typeof Events.Maintenance[keyof typeof Events.Maintenance];
export type PortfolioEvent = typeof Events.Portfolio[keyof typeof Events.Portfolio];
export type ConversationEvent = typeof Events.Conversation[keyof typeof Events.Conversation];
export type WhatsAppEvent = typeof Events.WhatsApp[keyof typeof Events.WhatsApp];
export type VacancyEvent = typeof Events.Vacancy[keyof typeof Events.Vacancy];
export type BrokerEvent = typeof Events.Broker[keyof typeof Events.Broker];
export type WorkOrderEvent = typeof Events.WorkOrder[keyof typeof Events.WorkOrder];
export type InspectionEvent = typeof Events.Inspection[keyof typeof Events.Inspection];
export type SupplierEvent = typeof Events.Supplier[keyof typeof Events.Supplier];
export type PurchaseOrderEvent = typeof Events.PurchaseOrder[keyof typeof Events.PurchaseOrder];
export type ComplianceEvent = typeof Events.Compliance[keyof typeof Events.Compliance];
export type ApprovalEvent = typeof Events.Approval[keyof typeof Events.Approval];
