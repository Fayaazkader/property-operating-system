// lib/platform/lifecycle/executor.ts
// Rule Executor — Executes actions with domain adapters

import { logger } from "@/lib/platform/events/logger.service";
import { RuleAction, ExecutionResult } from './types';
import { vacancyAdapter } from './adapters/vacancy.adapter';

export class RuleExecutor {
  async executeAction(item: any, action: RuleAction): Promise<ExecutionResult> {
    try {
      let result: any;

      switch (action.target) {
        case 'vacancy.create':
          result = await vacancyAdapter.createFromExpiredLease(item);
          break;
        default:
          result = { executed: false, message: `Unknown target: ${action.target}` };
      }

      return {
        success: true,
        action: action.type,
        target: action.target,
        result,
      };
    } catch (error) {
      return {
        success: false,
        action: action.type,
        target: action.target,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const ruleExecutor = new RuleExecutor();
