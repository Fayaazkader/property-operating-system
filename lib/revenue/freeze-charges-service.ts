// lib/revenue/freeze-charges-service.ts
// Generates and freezes charges for all active leases for a given period

import { supabase } from '@/lib/supabase';
import { generateChargesFromRules } from './charge-generator';
import { publish } from '@/lib/platform/events/event-bus';

export interface FreezeProgress {
  total: number;
  processed: number;
  currentLease: string;
  chargesCreated: number;
  status: 'idle' | 'running' | 'complete' | 'error';
  errors: string[];
}

export class FreezeChargesService {
  private progress: FreezeProgress = { total: 0, processed: 0, currentLease: '', chargesCreated: 0, status: 'idle', errors: [] };
  private onProgress?: (progress: FreezeProgress) => void;

  async freezeChargesForPeriod(
    entityId: string,
    periodStart: string,
    periodEnd: string,
    onProgress?: (progress: FreezeProgress) => void
  ): Promise<FreezeProgress> {
    this.onProgress = onProgress;
    this.progress = { total: 0, processed: 0, currentLease: '', chargesCreated: 0, status: 'running', errors: [] };

    const { data: activeLeases } = await supabase
      .from('leases')
      .select('id, lease_id, tenant_id')
      .not('property_id', 'is', null)
      .not('tenant_id', 'is', null)
      .eq('lease_status', 'Active');

    if (!activeLeases?.length) {
      this.progress.status = 'complete';
      this.emit();
      return this.progress;
    }

    this.progress.total = activeLeases.length;
    this.emit();

    for (const lease of activeLeases) {
      try {
        this.progress.currentLease = lease.lease_id;
        this.emit();

        const created = await generateChargesFromRules(lease.id, periodStart, periodEnd);
        this.progress.chargesCreated += created;
        this.progress.processed++;
        this.emit();
      } catch (err: any) {
        this.progress.errors.push(`${lease.lease_id}: ${err.message}`);
        this.progress.processed++;
        this.emit();
      }
    }

    this.progress.status = 'complete';
    this.progress.currentLease = '';
    this.emit();

    await publish('period.charges_frozen', {
      correlationId: crypto.randomUUID(),
      source: 'freeze-charges-service',
      version: '1.0',
      payload: {
        entityId,
        periodStart,
        periodEnd,
        totalLeases: this.progress.total,
        chargesCreated: this.progress.chargesCreated,
      },
    });

    return this.progress;
  }

  private emit() {
    if (this.onProgress) this.onProgress({ ...this.progress });
  }
}

export const freezeChargesService = new FreezeChargesService();
