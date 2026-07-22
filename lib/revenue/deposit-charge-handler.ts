// lib/revenue/deposit-charge-handler.ts
// Revenue responds to deposit charge requests — owns billing, not Deposit Engine

import { supabase } from '@/lib/supabase';
import { subscribe } from '@/lib/platform/events/event-bus';
import { logger } from '@/lib/platform/events/logger.service';

let initialized = false;

export function initializeDepositChargeHandler(): void {
  if (initialized) return;
  initialized = true;

  subscribe('revenue.deposit.charge.requested', async (event) => {
    const { leaseId, tenantId, propertyId, entityId, amount, description, dueDate, chargeType, glCode } = event.payload;

    // Revenue creates the deposit charge — just like rent
    await supabase.from('billing_rules').insert({
      lease_id: leaseId,
      rule_type: 'deposit',
      charge_code: 'DEPOSIT-001',
      description: description || 'Tenant Deposit',
      base_amount: amount,
      vat_rate: 0,
      gl_code: glCode || '2100',
      is_recoverable: false,
      frequency: 'once_off',
      status: 'active',
      effective_from: new Date().toISOString().split('T')[0],
    });

    logger.info('Deposit charge created by Revenue', { leaseId, amount });
  });
}
