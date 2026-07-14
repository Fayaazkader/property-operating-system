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
} as const;

export type EventName = typeof Events[keyof typeof Events];
export type LeaseEvent = typeof Events.Lease[keyof typeof Events.Lease];
export type StatementEvent = typeof Events.Statement[keyof typeof Events.Statement];
export type PaymentEvent = typeof Events.Payment[keyof typeof Events.Payment];
export type MaintenanceEvent = typeof Events.Maintenance[keyof typeof Events.Maintenance];
export type PortfolioEvent = typeof Events.Portfolio[keyof typeof Events.Portfolio];
