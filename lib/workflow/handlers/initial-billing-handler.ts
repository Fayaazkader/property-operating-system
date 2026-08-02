import { subscribe } from '@/lib/platform/events/event-bus';
import { initialBillingService } from '@/lib/revenue/initial-billing-service';
import { operationalJournal } from '@/lib/workflow/services/operational-journal';
import { publish } from '@/lib/platform/events/event-bus';

let registered = false;

export function registerInitialBillingHandler(): void {
  if (registered) return;
  registered = true;

  subscribe('lease.initial_billing_approved', async (event: any) => {
    const { leaseId, entityId, charges } = event.payload;
    if (!leaseId || !charges?.length) return;

    const posted = await initialBillingService.postCharges(leaseId, charges);

    await operationalJournal.log({
      entity_id: entityId,
      reference_type: 'lease',
      reference_id: leaseId,
      event_type: 'initial_billing_posted',
      description: `Initial billing posted — ${posted} charges`,
      metadata: { chargesPosted: posted },
    });

    await publish('lease.initial_billing_posted', {
      correlationId: event.correlationId || crypto.randomUUID(),
      source: 'initial-billing-handler',
      version: '1.0',
      payload: { leaseId, entityId, chargesPosted: posted },
    });
  });
}
