// lib/platform/lifecycle/adapters/vacancy.adapter.ts
// Vacancy Adapter — Connects Lifecycle Engine to Brokerage Operations

import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/platform/events/logger.service";
import { vacancyOrchestrator } from "@/lib/brokerage/engine/vacancy.orchestrator";

export class VacancyAdapter {
  private supabase = supabase;

  // ============================================================
  // CREATE VACANCY FROM EXPIRED LEASE
  // ============================================================

  async createFromExpiredLease(lease: any): Promise<{ success: boolean; vacancyId?: string; error?: string }> {
    try {
      // Check if vacancy already exists
      const { data: existing } = await this.supabase
        .from('vacancies')
        .select('id')
        .eq('lease_id', lease.id)
        .maybeSingle();

      if (existing) {
        return { success: true, vacancyId: existing.id };
      }

      // Create vacancy using the vacancy orchestrator
      const result = await vacancyOrchestrator.createFromLeaseEnd({
        lease_id: lease.id,
        property_id: lease.property_id,
        unit_id: lease.unit_id,
        vacancy_date: new Date().toISOString().split('T')[0],
        reason: 'lease_expired',
      });

      if (result.error || !result.data) {
        return { success: false, error: result.error?.message || 'Failed to create vacancy' };
      }

      // Update lease status
      await this.supabase
        .from('leases')
        .update({ lease_status: 'expired' })
        .eq('id', lease.id);

      logger.info(`✅ Vacancy created from expired lease ${lease.id}`, {
        vacancyId: result.data.id,
        unitId: lease.unit_id,
      });

      return { success: true, vacancyId: result.data.id };

    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const vacancyAdapter = new VacancyAdapter();
