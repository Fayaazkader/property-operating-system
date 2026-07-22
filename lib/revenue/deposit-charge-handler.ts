// lib/revenue/deposit-charge-handler.ts
// Revenue responds to deposit charge requests.
// Revenue owns billing rules, GL mapping, VAT treatment — not Lease.

import { supabase } from '@/lib/supabase';
import { subscribe } from '@/lib/platform/events/event-bus';
import { logger } from '@/lib/platform/events/logger.service';

let initialized = false;

export function initializeDepositChargeHandler(): void {
  if (initialized) return;
  initialized = true;

  subscribe('revenue.deposit.charge.requested', async (event) => {
    const { leaseId, amount, description, dueDate, entityId } = event.payload;

    // Revenue resolves the GL account from configuration — not hardcoded
    const { data: config } = await supabase
      .from('invoice_configs')
      .select('default_deposit_gl')
      .eq('entity_id', entityId)
      .single();

    const glCode = config?.default_deposit_gl || '2100'; // Default: Tenant Deposit Liability

    await supabase.from('billing_rules').insert({
      lease_id: leaseId,
      rule_type: 'deposit',
      charge_code: 'DEPOSIT-001',
      description: description || 'Tenant Deposit',
      base_amount: amount,
      vat_rate: 0,
      gl_code: glCode,
      is_recoverable: false,
      frequency: 'once_off',
      status: 'active',
      effective_from: new Date().toISOString().split('T')[0],
    });

    logger.info('Deposit charge created by Revenue', { leaseId, amount, glCode });
  });
}
