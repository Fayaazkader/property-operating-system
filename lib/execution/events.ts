// lib/execution/events.ts
// Execution Event Logger

import { SupabaseClient } from '@supabase/supabase-js';
import { ExecutionEventType } from './types';

interface LogEventParams {
  supabase: SupabaseClient;
  executionId: string;
  eventType: ExecutionEventType;
  eventData?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  userId?: string | null;
}

export async function logExecutionEvent(params: LogEventParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await params.supabase
      .from('execution_events')
      .insert({
        execution_id: params.executionId,
        event_type: params.eventType,
        event_data: params.eventData || {},
        ip_address: params.ipAddress,
        user_agent: params.userAgent,
        created_by: params.userId,
      });

    if (error) {
      console.error('Failed to log execution event:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to log execution event:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
