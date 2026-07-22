// lib/financial/deposit-engine.ts
// Deposit Engine — Reacts to business events. Never creates obligations or owns receipting.

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';
import { logger } from '@/lib/platform/events/logger.service';

export type DepositType = 'cash' | 'interest_bearing' | 'bank_guarantee' | 'insurance_guarantee';

export interface DepositAccount {
  id: string;
  entity_id: string;
  tenant_id: string;
  lease_id: string;
  property_id: string;
  deposit_type: DepositType;
  original_amount: number;
  interest_accrued: number;
  amount_claimed: number;
  amount_applied: number;
  amount_refunded: number;
  current_balance: number;
  interest_rate: number | null;
  interest_enabled: boolean;
  held_at_bank: string;
  guarantee_provider?: string;
  guarantee_number?: string;
  status: 'held' | 'partially_claimed' | 'partially_applied' | 'fully_applied' | 'refunded' | 'closed';
  held_since: string;
  last_interest_calc?: string;
  refunded_date?: string;
  closed_date?: string;
}

export const depositEngine = {
  // Reacts to lease.deposit.obligation.created — Lease owns the obligation
  async onObligationCreated(params: {
    entityId: string; tenantId: string; leaseId: string; propertyId: string;
    amount: number; depositType?: DepositType; interestRate?: number;
    heldAtBank?: string; guaranteeProvider?: string; guaranteeNumber?: string;
  }): Promise<DepositAccount> {
    const isInterestBearing = params.depositType === 'interest_bearing' || (!params.depositType && !!params.interestRate);
    const depositType = params.depositType || (params.interestRate ? 'interest_bearing' : 'cash');

    const { data, error } = await supabase.from('deposit_register').insert({
      entity_id: params.entityId,
      tenant_id: params.tenantId,
      lease_id: params.leaseId,
      property_id: params.propertyId,
      deposit_type: depositType,
      original_amount: params.amount,
      current_balance: params.amount,
      interest_rate: params.interestRate || null,
      interest_enabled: isInterestBearing,
      held_at_bank: params.heldAtBank || 'Trust Account',
      guarantee_provider: params.guaranteeProvider,
      guarantee_number: params.guaranteeNumber,
      status: 'held',
      held_since: new Date().toISOString().split('T')[0],
    }).select('*').single();

    if (error) throw error;

    await publish('deposit.register.created', {
      correlationId: crypto.randomUUID(),
      source: 'deposit-engine',
      version: '1.0',
      payload: { depositId: data.id, tenantId: params.tenantId, amount: params.amount, type: depositType },
    });

    return data as DepositAccount;
  },

  // Reacts to Cash Book allocation — does NOT own receipting
  async onReceiptAllocated(depositId: string): Promise<void> {
    const { data: deposit } = await supabase.from('deposit_register').select('*').eq('id', depositId).single();
    if (!deposit) return;

    await publish('deposit.receipt.confirmed', {
      correlationId: crypto.randomUUID(),
      source: 'deposit-engine',
      version: '1.0',
      payload: { depositId, tenantId: deposit.tenant_id, amount: deposit.original_amount },
    });
  },

  // Only for interest-bearing deposits. Bank guarantees never earn interest.
  async calculateInterest(depositId: string): Promise<number> {
    const { data: deposit } = await supabase.from('deposit_register').select('*').eq('id', depositId).single();
    if (!deposit || !deposit.interest_enabled || !deposit.interest_rate) return 0;
    if (deposit.deposit_type === 'bank_guarantee' || deposit.deposit_type === 'insurance_guarantee') return 0;

    const lastCalc = deposit.last_interest_calc ? new Date(deposit.last_interest_calc) : new Date(deposit.held_since);
    const daysHeld = Math.floor((Date.now() - lastCalc.getTime()) / 86400000);
    if (daysHeld <= 0) return 0;

    const dailyRate = deposit.interest_rate / 100 / 365;
    const interest = Math.round(deposit.current_balance * dailyRate * daysHeld * 100) / 100;

    if (interest > 0) {
      await supabase.from('deposit_register').update({
        interest_accrued: (deposit.interest_accrued || 0) + interest,
        current_balance: deposit.current_balance + interest,
        last_interest_calc: new Date().toISOString(),
      }).eq('id', depositId);

      await publish('deposit.interest.accrued', {
        correlationId: crypto.randomUUID(),
        source: 'deposit-engine',
        version: '1.0',
        payload: { depositId, amount: interest, tenantId: deposit.tenant_id },
      });
    }

    return interest;
  },

  async claimDeposit(depositId: string, amount: number, reason: string): Promise<void> {
    const { data: deposit } = await supabase.from('deposit_register').select('*').eq('id', depositId).single();
    if (!deposit) throw new Error('Deposit not found');

    const newBalance = deposit.current_balance - amount;
    await supabase.from('deposit_register').update({
      amount_claimed: (deposit.amount_claimed || 0) + amount,
      current_balance: newBalance,
      status: newBalance <= 0 ? 'fully_applied' : 'partially_claimed',
    }).eq('id', depositId);

    await publish('deposit.claimed', {
      correlationId: crypto.randomUUID(),
      source: 'deposit-engine',
      version: '1.0',
      payload: { depositId, amount, reason, tenantId: deposit.tenant_id },
    });
  },

  async applyToArrears(depositId: string, amount: number): Promise<void> {
    const { data: deposit } = await supabase.from('deposit_register').select('*').eq('id', depositId).single();
    if (!deposit) throw new Error('Deposit not found');

    const newBalance = deposit.current_balance - amount;
    await supabase.from('deposit_register').update({
      amount_applied: (deposit.amount_applied || 0) + amount,
      current_balance: newBalance,
      status: newBalance <= 0 ? 'fully_applied' : 'partially_applied',
    }).eq('id', depositId);

    await publish('deposit.applied.to.arrears', {
      correlationId: crypto.randomUUID(),
      source: 'deposit-engine',
      version: '1.0',
      payload: { depositId, amount, tenantId: deposit.tenant_id },
    });
  },

  async refundDeposit(depositId: string, amount: number): Promise<void> {
    const { data: deposit } = await supabase.from('deposit_register').select('*').eq('id', depositId).single();
    if (!deposit) throw new Error('Deposit not found');

    const newBalance = deposit.current_balance - amount;
    const isFullyRefunded = newBalance <= 0;

    await supabase.from('deposit_register').update({
      amount_refunded: (deposit.amount_refunded || 0) + amount,
      current_balance: Math.max(0, newBalance),
      status: isFullyRefunded ? 'refunded' : deposit.status,
      refunded_date: isFullyRefunded ? new Date().toISOString() : null,
    }).eq('id', depositId);

    await publish('deposit.refunded', {
      correlationId: crypto.randomUUID(),
      source: 'deposit-engine',
      version: '1.0',
      payload: { depositId, amount, tenantId: deposit.tenant_id },
    });
  },

  async getDeposit(tenantId: string): Promise<DepositAccount | null> {
    const { data } = await supabase.from('deposit_register').select('*').eq('tenant_id', tenantId).in('status', ['held', 'partially_claimed', 'partially_applied']).order('held_since', { ascending: false }).limit(1).single();
    return data as DepositAccount || null;
  }
};
