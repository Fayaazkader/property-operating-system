// lib/platform/automation/engine.ts
// Automation Engine — Production-grade orchestrator
// Targeted subscriptions, persisted cooldowns, execution logging, failure policies

import { logger } from '../events/logger.service';
import { ruleRegistry } from './rule-registry';
import { conditionEngine } from './condition-engine';
import { actionEngine } from './action-engine';
import { executionLog } from './execution-log';
import type { AutomationRule, AutomationExecutionContext, FailurePolicy } from './types';

export class AutomationEngine {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Subscribe only to events that have active rules
    await ruleRegistry.subscribeToActiveRuleEvents(this.processEvent.bind(this));

    // Refresh subscriptions periodically (every 5 minutes)
    setInterval(() => {
      ruleRegistry.refreshSubscriptions(this.processEvent.bind(this));
    }, 300000);

    this.initialized = true;
    logger.info('Automation Engine initialized');
  }

  private async processEvent(event: any): Promise<void> {
    const eventName = event.eventName;
    if (eventName.startsWith('notification.') || eventName.startsWith('automation.')) return;

    const rules = await ruleRegistry.getRulesByTrigger(eventName);
    for (const rule of rules) {
      await this.evaluateRule(rule, event);
    }
  }

  private async evaluateRule(rule: AutomationRule, event: any): Promise<void> {
    const correlationId = event.correlationId || crypto.randomUUID();
    const startedAt = new Date().toISOString();

    // Persisted cooldown check
    if (rule.cooldown_seconds && rule.last_triggered_at) {
      const elapsed = Date.now() - new Date(rule.last_triggered_at).getTime();
      if (elapsed < rule.cooldown_seconds * 1000) {
        return;
      }
    }

    const context: AutomationExecutionContext = {
      rule,
      event,
      correlationId,
      triggeredAt: startedAt,
    };

    // Evaluate conditions
    const payload = {
      ...event.payload,
      event: { name: event.eventName, entity: event.entity, actor: event.actor },
    };
    const conditionResults = conditionEngine.evaluate(rule.conditions, payload);

    if (!conditionEngine.allPassed(conditionResults)) {
      return;
    }

    logger.info('Automation rule triggered', { rule: rule.name, event: event.eventName, correlationId });

    // Log execution start
    const logEntry = await this.createLogEntry(rule, event, correlationId, startedAt, conditionResults);

    // Execute actions
    const actionResults = [];
    let hasFailure = false;

    for (const action of rule.actions) {
      const result = await actionEngine.execute(action, context);
      actionResults.push(result);
      if (!result.success) {
        hasFailure = true;
        logger.error('Automation action failed', { rule: rule.name, action: action.type, error: result.error });
      }
    }

    // Handle failure policy
    if (hasFailure) {
      await this.handleFailure(rule, event, context);
    }

    // Update last triggered
    await this.updateLastTriggered(rule.id);

    // Complete execution log
    const completedAt = new Date().toISOString();
    await executionLog.update(logEntry.id!, {
      status: hasFailure ? 'failed' : 'completed',
      actions_result: actionResults,
      completed_at: completedAt,
      duration_ms: Date.now() - new Date(startedAt).getTime(),
    });
  }

  private async handleFailure(rule: AutomationRule, event: any, context: AutomationExecutionContext): Promise<void> {
    const policy: FailurePolicy = rule.failure_policy || 'ignore';

    switch (policy) {
      case 'escalate':
        await this.escalate(rule, event, context);
        break;
      case 'stop':
        logger.warn('Automation workflow stopped due to failure', { rule: rule.name });
        break;
      case 'continue':
      case 'ignore':
      default:
        break;
    }
  }

  private async escalate(rule: AutomationRule, event: any, context: AutomationExecutionContext): Promise<void> {
    const { publish } = await import('../events/event-bus');
    await publish('notification.requested', {
      correlationId: context.correlationId,
      source: 'automation-engine',
      version: '1.0',
      payload: {
        event: 'automation.failed',
        recipient: 'system',
        recipient_type: 'system',
        data: {
          ruleName: rule.name,
          ruleId: rule.id,
          eventName: event.eventName,
          entityId: rule.entity_id,
        },
        priority: 'high',
        channels: ['in_app', 'email'],
      },
    });
  }

  private async createLogEntry(
    rule: AutomationRule,
    event: any,
    correlationId: string,
    startedAt: string,
    conditionResults: any
  ): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    await executionLog.log({
      id,
      rule_id: rule.id,
      entity_id: rule.entity_id,
      event_name: event.eventName,
      correlation_id: correlationId,
      status: 'started',
      conditions_result: conditionResults,
      started_at: startedAt,
    });
    return { id };
  }

  private async updateLastTriggered(ruleId: string): Promise<void> {
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase
        .from('automation_rules')
        .update({ last_triggered_at: new Date().toISOString() })
        .eq('id', ruleId);
    } catch {
      // Non-critical
    }
  }
}

export const automationEngine = new AutomationEngine();
