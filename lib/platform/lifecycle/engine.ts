// lib/platform/lifecycle/engine.ts
// Lifecycle Engine — Evaluates rules and executes actions

import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/platform/events/logger.service";
import { publish } from "@/lib/platform/events";
import { LifecycleRule, RuleCondition, RuleAction, DetectionResult, ExecutionResult } from './types';

export class LifecycleEngine {
  private supabase = supabase;

  // ============================================================
  // EVALUATE CONDITIONS
  // ============================================================

  evaluateConditions(item: any, conditions: RuleCondition[]): boolean {
    for (const condition of conditions) {
      const value = item[condition.field];
      let result = false;

      switch (condition.operator) {
        case 'eq':
          result = value === condition.value;
          break;
        case 'neq':
          result = value !== condition.value;
          break;
        case 'gt':
          result = value > condition.value;
          break;
        case 'gte':
          result = value >= condition.value;
          break;
        case 'lt':
          result = value < condition.value;
          break;
        case 'lte':
          result = value <= condition.value;
          break;
        case 'contains':
          result = String(value).includes(String(condition.value));
          break;
        case 'startsWith':
          result = String(value).startsWith(String(condition.value));
          break;
        case 'endsWith':
          result = String(value).endsWith(String(condition.value));
          break;
        default:
          result = false;
      }

      if (!result) return false;
    }

    return true;
  }

  // ============================================================
  // EXECUTE ACTIONS
  // ============================================================

  async executeActions(item: any, actions: RuleAction[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const action of actions) {
      try {
        let result: any;

        switch (action.type) {
          case 'publish_event':
            result = await this.executePublishEvent(item, action);
            break;
          case 'notify':
            result = await this.executeNotify(item, action);
            break;
          case 'execute':
            result = await this.executeAction(item, action);
            break;
          default:
            result = { message: `Unknown action type: ${action.type}` };
        }

        results.push({
          success: true,
          action: action.type,
          target: action.target,
          result,
        });
      } catch (error) {
        results.push({
          success: false,
          action: action.type,
          target: action.target,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  private async executePublishEvent(item: any, action: RuleAction): Promise<any> {
    const eventName = action.config.eventName || 'lifecycle.event';
    await publish(eventName, {
      correlationId: crypto.randomUUID(),
      source: 'lifecycle-engine',
      version: '1.0',
      payload: {
        item,
        action: action.config,
      },
    });
    return { event: eventName, published: true };
  }

  private async executeNotify(item: any, action: RuleAction): Promise<any> {
    // TODO: Integrate with Notification Engine
    logger.info(`🔔 Notification: ${action.config.message || 'Lifecycle event'}`, { item });
    return { sent: true, message: action.config.message };
  }

  private async executeAction(item: any, action: RuleAction): Promise<any> {
  const { ruleExecutor } = await import('./executor');
  return ruleExecutor.executeAction(item, action);
}

  // ============================================================
  // PROCESS RULES
  // ============================================================

  async processRules(items: any[], rules: LifecycleRule[]): Promise<{
    matched: number;
    executed: number;
    results: ExecutionResult[];
  }> {
    const allResults: ExecutionResult[] = [];
    let matched = 0;
    let executed = 0;

    for (const item of items) {
      for (const rule of rules) {
        if (!rule.enabled) continue;

        const matches = this.evaluateConditions(item, rule.conditions);
        if (matches) {
          matched++;
          const results = await this.executeActions(item, rule.actions);
          allResults.push(...results);
          executed += results.length;
        }
      }
    }

    return { matched, executed, results: allResults };
  }
}

export const lifecycleEngine = new LifecycleEngine();
