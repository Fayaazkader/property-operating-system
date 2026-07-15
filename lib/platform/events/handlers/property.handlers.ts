// lib/platform/events/handlers/property.handlers.ts
// Property Operations Event Handlers

import { subscribe, publish } from '../event-bus';
import { logger } from '../logger.service';
import { timelineService } from '@/lib/property-operations/timeline/timeline.service';

// ============================================================
// WORK ORDER EVENTS
// ============================================================

subscribe('property.work_order.created', async (event) => {
  const payload = event.payload || {};
  logger.info('🔧 Work order created', {
    workOrderId: payload.workOrderId,
    propertyId: payload.propertyId,
    priority: payload.priority,
    eventId: event.eventId,
  });

  if (payload.propertyId && payload.entityId) {
    await timelineService.addEntry({
      entity_id: payload.entityId,
      property_id: payload.propertyId,
      event_type: 'work_order_created',
      title: `Work order created: ${payload.title || 'New work order'}`,
      description: `Priority: ${payload.priority || 'medium'}`,
      reference_id: payload.workOrderId,
      reference_type: 'work_order',
      source: 'event-bus',
    });
  }

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'property-handler',
    version: '1.0',
    payload: {
      event: 'work.order.created',
      recipient: payload.propertyManagerId,
      recipient_type: 'user',
      data: {
        title: payload.title,
        priority: payload.priority,
        propertyName: payload.propertyName,
        description: payload.description,
        link: `/property-operations/work-orders/${payload.workOrderId}`,
      },
    },
  });
});

subscribe('property.work_order.completed', async (event) => {
  const payload = event.payload || {};
  logger.info('✅ Work order completed', {
    workOrderId: payload.workOrderId,
    propertyId: payload.propertyId,
    eventId: event.eventId,
  });

  if (payload.propertyId && payload.entityId) {
    await timelineService.addEntry({
      entity_id: payload.entityId,
      property_id: payload.propertyId,
      event_type: 'work_order_completed',
      title: `Work order completed: ${payload.title || 'Work order'}`,
      description: 'Work has been completed',
      reference_id: payload.workOrderId,
      reference_type: 'work_order',
      source: 'event-bus',
    });
  }

  if (payload.tenantId) {
    await publish('notification.requested', {
      correlationId: event.correlationId,
      source: 'property-handler',
      version: '1.0',
      payload: {
        event: 'work.order.completed',
        recipient: payload.tenantId,
        recipient_type: 'tenant',
        data: {
          title: payload.title,
          propertyName: payload.propertyName,
          completedAt: payload.completedAt,
          link: `/property-operations/work-orders/${payload.workOrderId}`,
        },
      },
    });
  }
});

// ============================================================
// INSPECTION EVENTS
// ============================================================

subscribe('property.inspection.created', async (event) => {
  const payload = event.payload || {};
  logger.info('📋 Inspection scheduled', {
    inspectionId: payload.inspectionId,
    propertyId: payload.propertyId,
    scheduledDate: payload.scheduledDate,
    eventId: event.eventId,
  });

  if (payload.propertyId && payload.entityId) {
    await timelineService.addEntry({
      entity_id: payload.entityId,
      property_id: payload.propertyId,
      event_type: 'inspection_scheduled',
      title: `Inspection scheduled: ${payload.title || 'Inspection'}`,
      description: `Scheduled for ${payload.scheduledDate}`,
      reference_id: payload.inspectionId,
      reference_type: 'inspection',
      source: 'event-bus',
    });
  }
});

subscribe('property.inspection.completed', async (event) => {
  const payload = event.payload || {};
  logger.info('✅ Inspection completed', {
    inspectionId: payload.inspectionId,
    propertyId: payload.propertyId,
    severity: payload.severity,
    eventId: event.eventId,
  });

  if (payload.propertyId && payload.entityId) {
    await timelineService.addEntry({
      entity_id: payload.entityId,
      property_id: payload.propertyId,
      event_type: 'inspection_completed',
      title: `Inspection completed: ${payload.title || 'Inspection'}`,
      description: `Severity: ${payload.severity || 'none'}`,
      reference_id: payload.inspectionId,
      reference_type: 'inspection',
      source: 'event-bus',
    });
  }

  if (payload.severity === 'critical' || payload.severity === 'high') {
    await publish('work.order.creation.requested', {
      correlationId: event.correlationId,
      source: 'property-handler',
      version: '1.0',
      payload: {
        propertyId: payload.propertyId,
        entityId: payload.entityId,
        title: `Critical inspection finding: ${payload.title || 'Inspection'}`,
        description: `Inspection ${payload.inspectionId} found critical issue`,
        priority: 'high',
        source: 'inspection',
        source_id: payload.inspectionId,
      },
    });
  }
});

// ============================================================
// COMPLIANCE EVENTS
// ============================================================

subscribe('property.compliance.expiring', async (event) => {
  const payload = event.payload || {};
  logger.info('⚠️ Compliance item expiring', {
    complianceId: payload.complianceId,
    propertyId: payload.propertyId,
    expiryDate: payload.expiryDate,
    eventId: event.eventId,
  });

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'property-handler',
    version: '1.0',
    payload: {
      event: 'compliance.expiring',
      recipient: payload.propertyManagerId,
      recipient_type: 'user',
      data: {
        name: payload.name,
        expiryDate: payload.expiryDate,
        propertyName: payload.propertyName,
        link: `/property-operations/compliance/${payload.complianceId}`,
      },
      priority: 'high',
    },
  });
});

subscribe('property.compliance.expired', async (event) => {
  const payload = event.payload || {};
  logger.info('❌ Compliance item expired', {
    complianceId: payload.complianceId,
    propertyId: payload.propertyId,
    expiryDate: payload.expiryDate,
    eventId: event.eventId,
  });

  await publish('notification.requested', {
    correlationId: event.correlationId,
    source: 'property-handler',
    version: '1.0',
    payload: {
      event: 'compliance.expired',
      recipient: payload.propertyManagerId,
      recipient_type: 'user',
      data: {
        name: payload.name,
        expiryDate: payload.expiryDate,
        propertyName: payload.propertyName,
        link: `/property-operations/compliance/${payload.complianceId}`,
      },
      priority: 'high',
    },
  });

  await publish('task.creation.requested', {
    correlationId: event.correlationId,
    source: 'property-handler',
    version: '1.0',
    payload: {
      title: `Renew compliance: ${payload.name || 'Compliance item'}`,
      description: `Compliance item expired on ${payload.expiryDate}`,
      priority: 'high',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      entityId: payload.entityId,
      reference_id: payload.complianceId,
      reference_type: 'compliance',
    },
  });
});

// ============================================================
// ASSET EVENTS
// ============================================================

subscribe('property.asset.serviced', async (event) => {
  const payload = event.payload || {};
  logger.info('🔧 Asset serviced', {
    assetId: payload.assetId,
    propertyId: payload.propertyId,
    serviceDate: payload.serviceDate,
    eventId: event.eventId,
  });

  if (payload.propertyId && payload.entityId) {
    await timelineService.addEntry({
      entity_id: payload.entityId,
      property_id: payload.propertyId,
      event_type: 'asset_serviced',
      title: `Asset serviced: ${payload.assetName || 'Asset'}`,
      description: `Serviced on ${payload.serviceDate}`,
      reference_id: payload.assetId,
      reference_type: 'asset',
      source: 'event-bus',
    });
  }
});
