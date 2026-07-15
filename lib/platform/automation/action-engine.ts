// lib/platform/automation/action-engine.ts
// Action Engine — Executes automation actions

import { publish } from '../events/event-bus';
import { logger } from '../events/logger.service';
import type { AutomationAction, ActionResult } from './types';

export class ActionEngine {
  async execute(action: AutomationAction, context: Record<string, any>): Promise<ActionResult> {
    try {
      let result: any;
      switch (action.type) {
        case 'publish_event': result = await this.executePublishEvent(action.config, context); break;
        case 'create_task': result = await this.executeCreateTask(action.config, context); break;
        case 'create_work_order': result = await this.executeCreateWorkOrder(action.config, context); break;
        case 'send_notification': result = await this.executeSendNotification(action.config, context); break;
        case 'update_entity': result = await this.executeUpdateEntity(action.config, context); break;
        default: return { success: false, action, error: `Unknown action type: ${action.type}` };
      }
      return { success: true, action, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Action execution failed', { action: action.type, error: message });
      return { success: false, action, error: message };
    }
  }

  private async executePublishEvent(config: Record<string, any>, context: Record<string, any>): Promise<void> {
    await publish(this.interpolate(config.event, context), {
      correlationId: context.correlationId,
      source: 'automation-engine',
      version: '1.0',
      payload: this.interpolateObject(config.payload || {}, context),
    });
  }

  private async executeCreateTask(config: Record<string, any>, context: Record<string, any>): Promise<void> {
    await publish('task.creation.requested', {
      correlationId: context.correlationId,
      source: 'automation-engine',
      version: '1.0',
      payload: this.interpolateObject({
        title: config.title,
        description: config.description,
        priority: config.priority || 'medium',
        dueDate: config.due_date,
        entityId: config.entity_id,
      }, context),
    });
  }

  private async executeCreateWorkOrder(config: Record<string, any>, context: Record<string, any>): Promise<void> {
    await publish('work.order.creation.requested', {
      correlationId: context.correlationId,
      source: 'automation-engine',
      version: '1.0',
      payload: this.interpolateObject({
        propertyId: config.property_id,
        entityId: config.entity_id,
        title: config.title,
        description: config.description,
        priority: config.priority || 'medium',
        source: 'automation',
      }, context),
    });
  }

  private async executeSendNotification(config: Record<string, any>, context: Record<string, any>): Promise<void> {
    await publish('notification.requested', {
      correlationId: context.correlationId,
      source: 'automation-engine',
      version: '1.0',
      payload: this.interpolateObject({
        event: config.event,
        recipient: config.recipient,
        recipient_type: config.recipient_type || 'user',
        data: config.data || {},
        priority: config.priority || 'medium',
        channels: config.channels || ['in_app'],
      }, context),
    });
  }

  private async executeUpdateEntity(config: Record<string, any>, context: Record<string, any>): Promise<void> {
    await publish('entity.update.requested', {
      correlationId: context.correlationId,
      source: 'automation-engine',
      version: '1.0',
      payload: this.interpolateObject({
        entity_type: config.entity_type,
        entity_id: config.entity_id,
        updates: config.updates || {},
      }, context),
    });
  }

  private interpolate(template: string, context: Record<string, any>): string {
    if (!template) return template;
    return template.replace(/\{\{(\w+(\.\w+)*)\}\}/g, (_, path) => {
      const value = this.resolvePath(path, context);
      return value !== undefined ? String(value) : `{{${path}}}`;
    });
  }

  private interpolateObject(obj: Record<string, any>, context: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') result[key] = this.interpolate(value, context);
      else if (typeof value === 'object' && value !== null) result[key] = this.interpolateObject(value, context);
      else result[key] = value;
    }
    return result;
  }

  private resolvePath(path: string, context: Record<string, any>): any {
    const parts = path.split('.');
    let value: any = context;
    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = value[part];
    }
    return value;
  }
}

export const actionEngine = new ActionEngine();
