// lib/platform/lifecycle/jobs/vacancy.job.ts
// Vacancy Job — Creates vacancies from expired leases

import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/platform/events/logger.service";
import { JobResult } from '../types';
import { lifecycleEngine } from '../engine';
import { vacancyRules } from '../rules/vacancy.rules';

export async function runVacancyJob(): Promise<JobResult> {
  logger.info('🔍 Running vacancy job...');

  try {
    // 1. Detect expired leases
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: expiredLeases, error } = await supabase
      .from('leases')
      .select(`
        id,
        tenant_id,
        property_id,
        unit_id,
        expiry_date,
        tenant_name,
        monthly_rental,
        entity_id,
        lease_status
      `)
      .eq('lease_status', 'active')
      .eq('expiry_date', yesterdayStr);

    if (error) {
      return {
        success: false,
        processed: 0,
        created: 0,
        failed: 0,
        errors: [error.message],
      };
    }

    if (!expiredLeases || expiredLeases.length === 0) {
      return {
        success: true,
        processed: 0,
        created: 0,
        failed: 0,
        metadata: { message: 'No expired leases found' },
      };
    }

    // 2. Process each expired lease with the rule engine
    const results = await lifecycleEngine.processRules(
      expiredLeases,
      vacancyRules
    );

    return {
      success: true,
      processed: expiredLeases.length,
      created: results.matched,
      failed: expiredLeases.length - results.matched,
      metadata: {
        matched: results.matched,
        executed: results.executed,
      },
    };
  } catch (error) {
    return {
      success: false,
      processed: 0,
      created: 0,
      failed: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
