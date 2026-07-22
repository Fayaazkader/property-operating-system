// lib/lease/deposit-obligation.ts
// Lease owns the deposit obligation. Deposit Engine reacts.
// Revenue determines GL mapping — not Lease.

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';

export interface DepositObligation {
  leaseId: string;
  tenantId: string;
  propertyId: string;
  entityId: string;
  amount: number;
  depositType: 'cash' | 'interest_bearing' | 'bank_guarantee' | 'insurance_guarantee';
  interestRate?: number;
  dueDate: string;
  requiredBeforeOccupation: boolean;
}

export const depositObligation = {
  async createFromLease(params: DepositObligation): Promise<void> {
    await supabase.from('leases').update({
      deposit_amount: params.amount,
      deposit_type: params.depositType,
      deposit_interest_rate: params.interestRate || null,
      deposit_due_date: params.dueDate,
      deposit_required_before_occupation: params.requiredBeforeOccupation,
    }).eq('id', params.leaseId);

    // Deposit Engine reacts
    await publish('lease.deposit.obligation.created', {
      correlationId: crypto.randomUUID(),
      source: 'lease-engine',
      version: '1.0',
      payload: params,
    });

    // Revenue raises the deposit charge — Revenue owns billing and GL mapping
    await publish('revenue.deposit.charge.requested', {
      correlationId: crypto.randomUUID(),
      source: 'lease-engine',
      version: '1.0',
      payload: {
        leaseId: params.leaseId,
        tenantId: params.tenantId,
        propertyId: params.propertyId,
        entityId: params.entityId,
        amount: params.amount,
        chargeType: 'deposit',
        description: 'Tenant Deposit',
        dueDate: params.dueDate,
      },
    });
  }
};
