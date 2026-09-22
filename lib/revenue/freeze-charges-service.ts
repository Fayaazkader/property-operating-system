import { supabase } from '@/lib/supabase';
import { generateChargesFromRules } from './charge-generator';
import { publish } from '@/lib/platform/events/event-bus';
import { claimPeriodPhase } from '@/lib/periods/concurrency';

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
    periodName: string,
    correlationId?: string
  ): Promise<FreezeProgress> {
    const cid = correlationId || crypto.randomUUID();

    const progress: FreezeProgress = {
      total: 0,
      processed: 0,
      currentLease: '',
      chargesCreated: 0,
      status: 'running',
      errors: [],
    };

    // Billing must be explicitly requested before execution can begin.
    const claim = await claimPeriodPhase(
      entityId,
      'statement',
      periodName,
      'billing_requested',
      'billing_running'
    );

    if (!claim.success) {
      progress.status = 'error';
      progress.errors.push(
        claim.message || 'Unable to claim billing run.'
      );

      
      await publish('period.charges_freeze_failed', {
        correlationId: cid,
        source: 'freeze-charges-service',
        version: '1.0',
        payload: {
          entityId,
          periodName,
          periodStart,
          periodEnd,
          ...progress,
        },
      });

      return progress;
    }

    const { data: activeLeases, error: leaseError } = await supabase
      .from('leases')
      .select('id, lease_id')
      .not('property_id', 'is', null)
      .not('tenant_id', 'is', null)
      .eq('lease_status', 'Active');

    if (leaseError) {
      progress.status = 'error';
      progress.errors.push(
        `Unable to load active leases: ${leaseError.message}`
      );

            await supabase
        .from('financial_periods')
        .update({ workflow_phase: 'billing_requested' })
        .eq('entity_id', entityId)
        .eq('period_type', 'statement')
        .eq('period_name', periodName)
        .eq('workflow_phase', 'billing_running');

      await publish('period.charges_freeze_failed', {
        correlationId: cid,
        source: 'freeze-charges-service',
        version: '1.0',
        payload: {
          entityId,
          periodName,
          periodStart,
          periodEnd,
          ...progress,
        },
      });

      return progress;
    }

        if (!activeLeases?.length) {
      progress.status = 'error';
      progress.errors.push('No active leases found.');

            await supabase
        .from('financial_periods')
        .update({ workflow_phase: 'billing_requested' })
        .eq('entity_id', entityId)
        .eq('period_type', 'statement')
        .eq('period_name', periodName)
        .eq('workflow_phase', 'billing_running');

      await publish('period.charges_freeze_failed', {
        correlationId: cid,
        source: 'freeze-charges-service',
        version: '1.0',
        payload: {
          entityId,
          periodName,
          periodStart,
          periodEnd,
          ...progress,
        },
      });

      return progress;
    }

    progress.total = activeLeases.length;

    await publish('period.charges_freezing', {
      correlationId: cid,
      source: 'freeze-charges-service',
      version: '1.0',
      payload: {
        entityId,
        periodName,
        periodStart,
        periodEnd,
        ...progress,
      },
    });

    for (const lease of activeLeases) {
      try {
        progress.currentLease = lease.lease_id;

        await publish('period.charge_lease_progress', {
          correlationId: cid,
          source: 'freeze-charges-service',
          version: '1.0',
          payload: {
            leaseId: lease.id,
            leaseRef: lease.lease_id,
            ...progress,
          },
        });

        const created = await generateChargesFromRules(
          lease.id,
          periodStart,
          periodEnd
        );

        progress.chargesCreated += created;
        progress.processed++;

        await publish('period.charge_lease_complete', {
          correlationId: cid,
          source: 'freeze-charges-service',
          version: '1.0',
          payload: {
            leaseId: lease.id,
            leaseRef: lease.lease_id,
            created,
            ...progress,
          },
        });
      } catch (err: any) {
        progress.errors.push(
          `${lease.lease_id}: ${err?.message || 'Unknown error'}`
        );
        progress.processed++;
      }
    }

    progress.currentLease = '';

    // Billing is complete only when every active lease was processed successfully.
    if (progress.errors.length > 0) {
  progress.status = 'error';

  await supabase
    .from('financial_periods')
    .update({ workflow_phase: 'billing_requested' })
    .eq('entity_id', entityId)
    .eq('period_type', 'statement')
    .eq('period_name', periodName)
    .eq('workflow_phase', 'billing_running');

  await publish('period.charges_freeze_failed', {
        correlationId: cid,
        source: 'freeze-charges-service',
        version: '1.0',
        payload: {
          entityId,
          periodName,
          periodStart,
          periodEnd,
          ...progress,
        },
      });

      return progress;
    }

    // Final completion transition is conditional on billing still being owned
    // by this run. A competing process cannot overwrite the phase.
    const { data: completedPeriod, error: completionError } = await supabase
      .from('financial_periods')
      .update({ workflow_phase: 'billing_complete' })
      .eq('entity_id', entityId)
      .eq('period_type', 'statement')
      .eq('period_name', periodName)
      .eq('workflow_phase', 'billing_running')
      .select('workflow_phase')
      .maybeSingle();

    if (completionError || !completedPeriod) {
      progress.status = 'error';
      progress.errors.push(
        completionError?.message ||
          'Billing completed, but the statement period could not be transitioned to billing_complete.'
      );

      await publish('period.charges_freeze_failed', {
        correlationId: cid,
        source: 'freeze-charges-service',
        version: '1.0',
        payload: {
          entityId,
          periodName,
          periodStart,
          periodEnd,
          ...progress,
        },
      });

      return progress;
    }

    progress.status = 'complete';

    await publish('period.charges_frozen', {
      correlationId: cid,
      source: 'freeze-charges-service',
      version: '1.0',
      payload: {
        entityId,
        periodName,
        periodStart,
        periodEnd,
        ...progress,
      },
    });

    return progress;
  }
}

export const freezeChargesService = new FreezeChargesService();
