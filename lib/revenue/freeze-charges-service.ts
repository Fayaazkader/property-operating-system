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
  async freezeChargesForPeriod(
    entityId: string,
    periodStart: string,
    periodEnd: string,
    correlationId?: string
  ): Promise<FreezeProgress> {
    const cid = correlationId || crypto.randomUUID();
    const progress: FreezeProgress = { total: 0, processed: 0, currentLease: '', chargesCreated: 0, status: 'running', errors: [] };

    const { data: activeLeases } = await supabase
      .from('leases')
      .select('id, lease_id')
      .not('property_id', 'is', null)
      .not('tenant_id', 'is', null)
      .eq('lease_status', 'Active');

    if (!activeLeases?.length) {
      progress.status = 'complete';
      await publish('period.charges_frozen', { correlationId: cid, source: 'freeze-charges-service', version: '1.0', payload: { entityId, ...progress } });
      return progress;
    }

    progress.total = activeLeases.length;
    await publish('period.charges_freezing', { correlationId: cid, source: 'freeze-charges-service', version: '1.0', payload: { entityId, ...progress } });

    for (const lease of activeLeases) {
      try {
        progress.currentLease = lease.lease_id;
        await publish('period.charge_lease_progress', { correlationId: cid, source: 'freeze-charges-service', version: '1.0', payload: { leaseId: lease.id, leaseRef: lease.lease_id, ...progress } });

        const created = await generateChargesFromRules(lease.id, periodStart, periodEnd);
        progress.chargesCreated += created;
        progress.processed++;
        await publish('period.charge_lease_complete', { correlationId: cid, source: 'freeze-charges-service', version: '1.0', payload: { leaseId: lease.id, leaseRef: lease.lease_id, created, ...progress } });
      } catch (err: any) {
        progress.errors.push(`${lease.lease_id}: ${err.message}`);
        progress.processed++;
      }
    }

    progress.status = 'complete';
    progress.currentLease = '';
    
    // Update statement period workflow phase
    await supabase.from('financial_periods').update({ workflow_phase: 'billing_complete' }).eq('entity_id', entityId).eq('period_type', 'statement').eq('status', 'open');
    
    await publish('period.charges_frozen', { correlationId: cid, source: 'freeze-charges-service', version: '1.0', payload: { entityId, periodStart, periodEnd, ...progress } });

    return progress;
  }
}

export const freezeChargesService = new FreezeChargesService();
