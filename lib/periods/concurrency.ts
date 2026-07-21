// lib/periods/concurrency.ts
// Atomic optimistic locking — conditional UPDATE prevents race windows

import { supabase } from '@/lib/supabase';

export async function withOptimisticLock(
  entityId: string,
  periodType: string,
  periodName: string,
  expectedPhase: string,
  newPhase: string,
  fn: () => Promise<any>
): Promise<any> {
  // Atomic conditional update — only updates if phase matches expected
  const { data, error } = await supabase
    .from('financial_periods')
    .update({ workflow_phase: newPhase })
    .eq('entity_id', entityId)
    .eq('period_type', periodType)
    .eq('period_name', periodName)
    .eq('workflow_phase', expectedPhase)
    .select('id')
    .single();

  if (error || !data) {
    // Lock failed — someone else changed it
    const { data: current } = await supabase
      .from('financial_periods')
      .select('workflow_phase')
      .eq('entity_id', entityId)
      .eq('period_type', periodType)
      .eq('period_name', periodName)
      .single();

    return {
      success: false,
      message: `Phase conflict: expected ${expectedPhase}, got ${current?.workflow_phase || 'unknown'}. Another process may have changed it.`,
      concurrencyConflict: true,
    };
  }

  // Lock acquired — execute work
  return fn();
}
