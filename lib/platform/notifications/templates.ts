// lib/platform/notifications/templates.ts
// Notification Templates

import { NotificationTemplate } from './types';

export const notificationTemplates: NotificationTemplate[] = [
  {
    id: 'work.order.created',
    event: 'work.order.created',
    channels: {
      whatsapp: '🔧 New work order: {{title}}\nPriority: {{priority}}\nProperty: {{propertyName}}\n\nView: {{link}}',
      email: {
        subject: 'New Work Order Created',
        body: 'A new work order has been created:\n\nTitle: {{title}}\nPriority: {{priority}}\nProperty: {{propertyName}}\nDescription: {{description}}\n\nView work order: {{link}}',
      },
      in_app: 'New work order created: {{title}}',
      push: '🔧 New work order: {{title}}',
      sms: 'New work order: {{title}}',
    },
    default_channel: 'whatsapp',
    priority: 'medium',
  },
  {
    id: 'work.order.completed',
    event: 'work.order.completed',
    channels: {
      whatsapp: '✅ Work order completed: {{title}}\nProperty: {{propertyName}}\n\nView: {{link}}',
      email: {
        subject: 'Work Order Completed',
        body: 'Work order has been completed:\n\nTitle: {{title}}\nProperty: {{propertyName}}\nCompleted at: {{completedAt}}\n\nView work order: {{link}}',
      },
      in_app: 'Work order completed: {{title}}',
      push: '✅ Work order completed: {{title}}',
      sms: 'Work order completed: {{title}}',
    },
    default_channel: 'email',
    priority: 'medium',
  },
  {
    id: 'work.order.sla.breached',
    event: 'work.order.sla.breached',
    channels: {
      whatsapp: '🚨 SLA Breached: {{title}}\nPriority: {{priority}}\nProperty: {{propertyName}}\n\nAction required immediately.',
      email: {
        subject: '🚨 SLA Breached',
        body: 'SLA has been breached for work order:\n\nTitle: {{title}}\nPriority: {{priority}}\nProperty: {{propertyName}}\nCreated at: {{createdAt}}\n\nAction required immediately.',
      },
      in_app: '🚨 SLA Breached: {{title}}',
      push: '��� SLA Breached: {{title}}',
      sms: 'SLA breached: {{title}}',
    },
    default_channel: 'whatsapp',
    priority: 'high',
  },
  {
    id: 'inspection.completed',
    event: 'inspection.completed',
    channels: {
      whatsapp: '📋 Inspection completed: {{title}}\nProperty: {{propertyName}}\nSeverity: {{severity}}\n\nView: {{link}}',
      email: {
        subject: 'Inspection Completed',
        body: 'Inspection has been completed:\n\nTitle: {{title}}\nProperty: {{propertyName}}\nSeverity: {{severity}}\nCompleted at: {{completedAt}}\n\nView inspection: {{link}}',
      },
      in_app: 'Inspection completed: {{title}}',
      push: '📋 Inspection completed: {{title}}',
      sms: 'Inspection completed: {{title}}',
    },
    default_channel: 'email',
    priority: 'medium',
  },
  {
    id: 'compliance.expiring',
    event: 'compliance.expiring',
    channels: {
      whatsapp: '⚠️ Compliance expiring: {{name}}\nExpiry: {{expiryDate}}\nProperty: {{propertyName}}\n\nAction required.',
      email: {
        subject: '⚠️ Compliance Item Expiring',
        body: 'A compliance item is expiring soon:\n\nName: {{name}}\nExpiry Date: {{expiryDate}}\nProperty: {{propertyName}}\n\nAction required.',
      },
      in_app: '⚠️ Compliance expiring: {{name}}',
      push: '⚠️ Compliance expiring: {{name}}',
      sms: 'Compliance expiring: {{name}}',
    },
    default_channel: 'whatsapp',
    priority: 'high',
  },
  {
    id: 'compliance.expired',
    event: 'compliance.expired',
    channels: {
      whatsapp: '❌ Compliance expired: {{name}}\nExpiry: {{expiryDate}}\nProperty: {{propertyName}}\n\nImmediate action required.',
      email: {
        subject: '❌ Compliance Item Expired',
        body: 'A compliance item has expired:\n\nName: {{name}}\nExpiry Date: {{expiryDate}}\nProperty: {{propertyName}}\n\nImmediate action required.',
      },
      in_app: '❌ Compliance expired: {{name}}',
      push: '❌ Compliance expired: {{name}}',
      sms: 'Compliance expired: {{name}}',
    },
    default_channel: 'whatsapp',
    priority: 'high',
  },
  {
    id: 'payment.received',
    event: 'payment.received',
    channels: {
      whatsapp: '💳 Payment received\nAmount: {{amount}}\nTenant: {{tenantName}}\nReference: {{reference}}\n\nView: {{link}}',
      email: {
        subject: 'Payment Received',
        body: 'Payment has been received:\n\nAmount: {{amount}}\nTenant: {{tenantName}}\nReference: {{reference}}\nDate: {{date}}\n\nView payment: {{link}}',
      },
      in_app: '💳 Payment received: {{amount}}',
      push: '💳 Payment received: {{amount}}',
      sms: 'Payment received: {{amount}}',
    },
    default_channel: 'email',
    priority: 'medium',
  },
  {
    id: 'lease.activated',
    event: 'lease.activated',
    channels: {
      whatsapp: '✅ Lease activated\nTenant: {{tenantName}}\nProperty: {{propertyName}}\nMonthly Rental: {{monthlyRental}}\n\nView: {{link}}',
      email: {
        subject: 'Lease Activated',
        body: 'Lease has been activated:\n\nTenant: {{tenantName}}\nProperty: {{propertyName}}\nMonthly Rental: {{monthlyRental}}\nCommencement Date: {{commencementDate}}\n\nView lease: {{link}}',
      },
      in_app: '✅ Lease activated: {{tenantName}}',
      push: '✅ Lease activated: {{tenantName}}',
      sms: 'Lease activated: {{tenantName}}',
    },
    default_channel: 'whatsapp',
    priority: 'high',
  },
  {
    id: 'commission.approved',
    event: 'commission.approved',
    channels: {
      whatsapp: '💰 Commission approved\nBroker: {{brokerName}}\nLease: {{leaseRef}}\nAmount: {{amount}}\n\nView: {{link}}',
      email: {
        subject: 'Commission Approved',
        body: 'Commission has been approved:\n\nBroker: {{brokerName}}\nLease: {{leaseRef}}\nAmount: {{amount}}\nApproved by: {{approvedBy}}\n\nView commission: {{link}}',
      },
      in_app: '💰 Commission approved: {{amount}}',
      push: '💰 Commission approved: {{amount}}',
      sms: 'Commission approved: {{amount}}',
    },
    default_channel: 'email',
    priority: 'medium',
  },
  {
    id: 'supplier.invoice.due',
    event: 'supplier.invoice.due',
    channels: {
      whatsapp: '📄 Supplier invoice due\nSupplier: {{supplierName}}\nAmount: {{amount}}\nDue: {{dueDate}}\n\nView: {{link}}',
      email: {
        subject: 'Supplier Invoice Due',
        body: 'A supplier invoice is due:\n\nSupplier: {{supplierName}}\nAmount: {{amount}}\nDue Date: {{dueDate}}\nInvoice Number: {{invoiceNumber}}\n\nView invoice: {{link}}',
      },
      in_app: '📄 Supplier invoice due: {{amount}}',
      push: '📄 Supplier invoice due: {{amount}}',
      sms: 'Supplier invoice due: {{amount}}',
    },
    default_channel: 'email',
    priority: 'medium',
  },
];

export function getTemplate(event: string): NotificationTemplate | undefined {
  return notificationTemplates.find(t => t.event === event);
}

export function renderTemplate(template: string, data: Record<string, any>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(data)) {
    rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), String(value || ''));
  }
  return rendered;
}
