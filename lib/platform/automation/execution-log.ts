// lib/platform/automation/execution-log.ts
// Execution Log — Records every automation execution for audit and troubleshooting

import { supabase } from '@/lib/supabase';
import { logger } from '../events/logger.service';
import type { ExecutionLogEntry } from './types';

export class ExecutionLog {
  async log(entry: ExecutionLogEntry): Promise<void> {
    try {
      const { error } = await supabase
        .from('automation_execution_log')
        .insert({
          rule_id: entry.rule_id,
          entity_id: entry.entity_id,
          event_name: entry.event_name,
          correlation_id: entry.correlation_id,
          status: entry.status,
          conditions_result: entry.conditions_result,
          actions_result: entry.actions_result,
          error: entry.error,
          started_at: entry.started_at,
          completed_at: entry.completed_at,
          duration_ms: entry.duration_ms,
        });

      if (error) {
        logger.error('Failed to write execution log', { error });
      }
    } catch (error) {
      logger.error('Failed to write execution log', { error });
    }
  }

  async update(id: string, updates: Partial<ExecutionLogEntry>): Promise<void> {
    try {
      await supabase
        .from('automation_execution_log')
        .update(updates)
        .eq('id', id);
    } catch (error) {
      logger.error('Failed to update execution log', { error });
    }
  }
}

export const executionLog = new ExecutionLog();
