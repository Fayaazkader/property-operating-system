// lib/periods/concurrency.ts
// Atomic billing ownership claim.
// The caller must claim the period before executing business work.

import { supabase } from '@/lib/supabase';

export async function claimPeriodPhase(
  entityId: string,
  periodType: string,
  periodName: string,
  expectedPhase: string,
  newPhase: string
): Promise<{
  success: boolean;
  message?: string;
  concurrencyConflict?: boolean;
}> {
  const { data, error } = await supabase
    .from('financial_periods')
    .update({ workflow_phase: newPhase })
    .eq('entity_id', entityId)
    .eq('period_type', periodType)
    .eq('period_name', periodName)
    .eq('workflow_phase', expectedPhase)
    .select('workflow_phase')
    .maybeSingle();

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  if (!data) {
    return {
      success: false,
      message: `Phase conflict: expected ${expectedPhase}. Another process may have started or changed this billing run.`,
      concurrencyConflict: true,
    };
  }

  return {
    success: true,
  };
}
