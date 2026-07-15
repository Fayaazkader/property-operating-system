// lib/platform/notifications/handlers/index.ts
// Notification Event Handlers

import { subscribe } from '../../event-bus';
import { logger } from '../../events/logger.service';
import { notificationEngine } from '../engine';

// ============================================================
// WORK ORDER EVENTS
// ============================================================

subscribe('property.work_order.created', async (event) => {
  const payload = event.payload || {};
  const propertyManagerId = payload.propertyManagerId;

  if (propertyManagerId) {
    await notificationEngine.send({
      event: 'work.order.created',
      recipient: propertyManagerId,
      recipient_type: 'user',
      data: {
        title: payload.title,
        priority: payload.priority,
        propertyName: payload.propertyName,
        description: payload.description,
        link: `/property-operations/work-orders/${payload.workOrderId}`,
      },
      correlation_id: event.correlationId,
    });
  }
});

subscribe('property.work_order.completed', async (event) => {
  const payload = event.payload || {};
  const tenantId = payload.tenantId;

  if (tenantId) {
    await notificationEngine.send({
      event: 'work.order.completed',
      recipient: tenantId,
      recipient_type: 'tenant',
      data: {
        title: payload.title,
        propertyName: payload.propertyName,
        completedAt: payload.completedAt,
        link: `/property-operations/work-orders/${payload.workOrderId}`,
      },
      correlation_id: event.correlationId,
    });
  }
});

subscribe('property.work_order.sla.breached', async (event) => {
  const payload = event.payload || {};
  const propertyManagerId = payload.propertyManagerId;

  if (propertyManagerId) {
    await notificationEngine.send({
      event: 'work.order.sla.breached',
      recipient: propertyManagerId,
      recipient_type: 'user',
      data: {
        title: payload.title,
        priority: payload.priority,
        propertyName: payload.propertyName,
        createdAt: payload.createdAt,
        link: `/property-operations/work-orders/${payload.workOrderId}`,
      },
      correlation_id: event.correlationId,
      priority: 'high',
    });
  }
});

// ============================================================
// INSPECTION EVENTS
// ============================================================

subscribe('property.inspection.completed', async (event) => {
  const payload = event.payload || {};
  const propertyManagerId = payload.propertyManagerId;

  if (propertyManagerId) {
    await notificationEngine.send({
      event: 'inspection.completed',
      recipient: propertyManagerId,
      recipient_type: 'user',
      data: {
        title: payload.title,
        propertyName: payload.propertyName,
        severity: payload.severity,
        completedAt: payload.completedAt,
        link: `/property-operations/inspections/${payload.inspectionId}`,
      },
      correlation_id: event.correlationId,
    });
  }
});

// ============================================================
// COMPLIANCE EVENTS
// ============================================================

subscribe('property.compliance.expiring', async (event) => {
  const payload = event.payload || {};
  const propertyManagerId = payload.propertyManagerId;

  if (propertyManagerId) {
    await notificationEngine.send({
      event: 'compliance.expiring',
      recipient: propertyManagerId,
      recipient_type: 'user',
      data: {
        name: payload.name,
        expiryDate: payload.expiryDate,
        propertyName: payload.propertyName,
        link: `/property-operations/compliance/${payload.complianceId}`,
      },
      correlation_id: event.correlationId,
      priority: 'high',
    });
  }
});

subscribe('property.compliance.expired', async (event) => {
  const payload = event.payload || {};
  const propertyManagerId = payload.propertyManagerId;

  if (propertyManagerId) {
    await notificationEngine.send({
      event: 'compliance.expired',
      recipient: propertyManagerId,
      recipient_type: 'user',
      data: {
        name: payload.name,
        expiryDate: payload.expiryDate,
        propertyName: payload.propertyName,
        link: `/property-operations/compliance/${payload.complianceId}`,
      },
      correlation_id: event.correlationId,
      priority: 'high',
    });
  }
});

// ============================================================
// LEASE EVENTS
// ============================================================

subscribe('lease.activated', async (event) => {
  const payload = event.payload || {};
  const tenantId = payload.tenantId;

  if (tenantId) {
    await notificationEngine.send({
      event: 'lease.activated',
      recipient: tenantId,
      recipient_type: 'tenant',
      data: {
        tenantName: payload.tenantName,
        propertyName: payload.propertyName,
        monthlyRental: payload.monthlyRental,
        commencementDate: payload.commencementDate,
        link: `/leases/${payload.leaseId}`,
      },
      correlation_id: event.correlationId,
    });
  }
});

// ============================================================
// COMMISSION EVENTS
// ============================================================

subscribe('broker.commission.approved', async (event) => {
  const payload = event.payload || {};
  const brokerId = payload.brokerId;

  if (brokerId) {
    await notificationEngine.send({
      event: 'commission.approved',
      recipient: brokerId,
      recipient_type: 'broker',
      data: {
        brokerName: payload.brokerName,
        leaseRef: payload.leaseRef,
        amount: payload.amount,
        approvedBy: payload.approvedBy,
        link: `/brokerage/commissions/${payload.commissionId}`,
      },
      correlation_id: event.correlationId


mkdir -p lib/platform/notifications/handlers
cat > lib/platform/notifications/handlers/index.ts << 'ENDOFFILE'
// lib/platform/notifications/handlers/index.ts
// Notification Event Handlers

import { subscribe } from '../../event-bus';
import { logger } from '../../events/logger.service';
import { notificationEngine } from '../engine';

// ============================================================
// WORK ORDER EVENTS
// ============================================================

subscribe('property.work_order.created', async (event) => {
  const payload = event.payload || {};
  const propertyManagerId = payload.propertyManagerId;

  if (propertyManagerId) {
    await notificationEngine.send({
      event: 'work.order.created',
      recipient: propertyManagerId,
      recipient_type: 'user',
      data: {
        title: payload.title,
        priority: payload.priority,
        propertyName: payload.propertyName,
        description: payload.description,
        link: `/property-operations/work-orders/${payload.workOrderId}`,
      },
      correlation_id: event.correlationId,
    });
  }
});

subscribe('property.work_order.completed', async (event) => {
  const payload = event.payload || {};
  const tenantId = payload.tenantId;

  if (tenantId) {
    await notificationEngine.send({
      event: 'work.order.completed',
      recipient: tenantId,
      recipient_type: 'tenant',
      data: {
        title: payload.title,
        propertyName: payload.propertyName,
        completedAt: payload.completedAt,
        link: `/property-operations/work-orders/${payload.workOrderId}`,
      },
      correlation_id: event.correlationId,
    });
  }
});

subscribe('property.work_order.sla.breached', async (event) => {
  const payload = event.payload || {};
  const propertyManagerId = payload.propertyManagerId;

  if (propertyManagerId) {
    await notificationEngine.send({
      event: 'work.order.sla.breached',
      recipient: propertyManagerId,
      recipient_type: 'user',
      data: {
        title: payload.title,
        priority: payload.priority,
        propertyName: payload.propertyName,
        createdAt: payload.createdAt,
        link: `/property-operations/work-orders/${payload.workOrderId}`,
      },
      correlation_id: event.correlationId,
      priority: 'high',
    });
  }
});

// ============================================================
// INSPECTION EVENTS
// ============================================================

subscribe('property.inspection.completed', async (event) => {
  const payload = event.payload || {};
  const propertyManagerId = payload.propertyManagerId;

  if (propertyManagerId) {
    await notificationEngine.send({
      event: 'inspection.completed',
      recipient: propertyManagerId,
      recipient_type: 'user',
      data: {
        title: payload.title,
        propertyName: payload.propertyName,
        severity: payload.severity,
        completedAt: payload.completedAt,
        link: `/property-operations/inspections/${payload.inspectionId}`,
      },
      correlation_id: event.correlationId,
    });
  }
});

// ============================================================
// COMPLIANCE EVENTS
// ============================================================

subscribe('property.compliance.expiring', async (event) => {
  const payload = event.payload || {};
  const propertyManagerId = payload.propertyManagerId;

  if (propertyManagerId) {
    await notificationEngine.send({
      event: 'compliance.expiring',
      recipient: propertyManagerId,
      recipient_type: 'user',
      data: {
        name: payload.name,
        expiryDate: payload.expiryDate,
        propertyName: payload.propertyName,
        link: `/property-operations/compliance/${payload.complianceId}`,
      },
      correlation_id: event.correlationId,
      priority: 'high',
    });
  }
});

subscribe('property.compliance.expired', async (event) => {
  const payload = event.payload || {};
  const propertyManagerId = payload.propertyManagerId;

  if (propertyManagerId) {
    await notificationEngine.send({
      event: 'compliance.expired',
      recipient: propertyManagerId,
      recipient_type: 'user',
      data: {
        name: payload.name,
        expiryDate: payload.expiryDate,
        propertyName: payload.propertyName,
        link: `/property-operations/compliance/${payload.complianceId}`,
      },
      correlation_id: event.correlationId,
      priority: 'high',
    });
  }
});

// ============================================================
// LEASE EVENTS
// ============================================================

subscribe('lease.activated', async (event) => {
  const payload = event.payload || {};
  const tenantId = payload.tenantId;

  if (tenantId) {
    await notificationEngine.send({
      event: 'lease.activated',
      recipient: tenantId,
      recipient_type: 'tenant',
      data: {
        tenantName: payload.tenantName,
        propertyName: payload.propertyName,
        monthlyRental: payload.monthlyRental,
        commencementDate: payload.commencementDate,
        link: `/leases/${payload.leaseId}`,
      },
      correlation_id: event.correlationId,
    });
  }
});

// ============================================================
// COMMISSION EVENTS
// ============================================================

subscribe('broker.commission.approved', async (event) => {
  const payload = event.payload || {};
  const brokerId = payload.brokerId;

  if (brokerId) {
    await notificationEngine.send({
      event: 'commission.approved',
      recipient: brokerId,
      recipient_type: 'broker',
      data: {
        brokerName: payload.brokerName,
        leaseRef: payload.leaseRef,
        amount: payload.amount,
        approvedBy: payload.approvedBy,
        link: `/brokerage/commissions/${payload.commissionId}`,
      },
      correlation_id: event.correlationId,
    });
  }
});

// ============================================================
// PAYMENT EVENTS
// ============================================================

subscribe('payment.received', async (event) => {
  const payload = event.payload || {};
  const tenantId = payload.tenantId;

  if (tenantId) {
    await notificationEngine.send({
      event: 'payment.received',
      recipient: tenantId,
      recipient_type: 'tenant',
      data: {
        amount: payload.amount,
        tenantName: payload.tenantName,
        reference: payload.reference,
        date: payload.date,
        link: `/financials/payments/${payload.paymentId}`,
      },
      correlation_id: event.correlationId,
    });
  }
});
