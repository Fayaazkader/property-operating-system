// lib/periods/concurrency.ts
// Atomic optimistic locking — validates ownership, then executes work, then transitions

import { supabase } from '@/lib/supabase';

export async function withOptimisticLock(
  entityId: string,
  periodType: string,
  periodName: string,
  expectedPhase: string,
  newPhase: string,
  fn: () => Promise<{ success: boolean; rollbackPhase?: string }>
): Promise<any> {
  // STEP 1: Validate the current phase matches expected — but DON'T transition yet
  const { data: current } = await supabase
    .from('financial_periods')
    .select('workflow_phase')
    .eq('entity_id', entityId)
    .eq('period_type', periodType)
    .eq('period_name', periodName)
    .single();

  if (current?.workflow_phase !== expectedPhase) {
    return {
      success: false,
      message: `Phase conflict: expected ${expectedPhase}, got ${current?.workflow_phase || 'unknown'}. Another process may have changed it.`,
      concurrencyConflict: true,
    };
  }

  // STEP 2: Execute business logic — phase has NOT changed yet
  const result = await fn();

  if (!result.success) {
    // Business logic failed — phase stays as it was. No rollback needed.
    return result;
  }

  // STEP 3: Business logic succeeded — NOW transition the phase atomically
  const { error: updateError } = await supabase
    .from('financial_periods')
    .update({ workflow_phase: newPhase })
    .eq('entity_id', entityId)
    .eq('period_type', periodType)
    .eq('period_name', periodName)
    .eq('workflow_phase', expectedPhase); // Double-check no one changed it during execution

  if (updateError) {
    return {
      success: false,
      message: 'Phase transition failed after successful execution. Manual review required.',
      concurrencyConflict: true,
    };
  }

  return result;
}
