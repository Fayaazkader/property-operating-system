// lib/revenue/interest-engine.ts
// Interest & Late Fee Engine — Scheduled service that feeds Revenue Operations

import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/platform/events/event-bus';

interface OverdueLease {
  leaseId: string;
  tenantId: string;
  tenantName: string;
  overdueAmount: number;
  daysOverdue: number;
  interestRate: number;
  lateFeeAmount: number;
}

export const interestEngine = {
  async calculateCharges(entityId: string): Promise<{ interestCharges: number; lateFees: number }> {
    const today = new Date().toISOString().split('T')[0];
    let interestCount = 0, lateFeeCount = 0;

    // Find overdue tenants from sub-ledger
    const { data: overdueEntries } = await supabase
      .from('sub_ledger_entries')
      .select('tenant_id, running_balance')
      .eq('entity_id', entityId)
      .eq('ledger_type', 'tenant')
      .gt('running_balance', 0)
      .order('posted_at', { ascending: false })
      .limit(100);

    if (!overdueEntries?.length) return { interestCharges: 0, lateFees: 0 };

    // Get unique tenant IDs with balances
    const tenantBalances = new Map<string, number>();
    for (const entry of overdueEntries) {
      if (!tenantBalances.has(entry.tenant_id)) {
        tenantBalances.set(entry.tenant_id, entry.running_balance);
      }
    }

    for (const [tenantId, balance] of tenantBalances) {
      // Get active lease for tenant
      const { data: lease } = await supabase
        .from('leases')
        .select('id, tenant_name, lease_id')
        .eq('tenant_id', tenantId)
        .eq('lease_status', 'Active')
        .single();

      if (!lease || balance <= 0) continue;

      // Find oldest overdue invoice to calculate days
      const { data: oldestEntry } = await supabase
        .from('sub_ledger_entries')
        .select('posted_at')
        .eq('tenant_id', tenantId)
        .eq('ledger_type', 'tenant')
        .gt('running_balance', 0)
        .order('posted_at', { ascending: true })
        .limit(1)
        .single();

      if (!oldestEntry) continue;

      const daysOverdue = Math.floor((Date.now() - new Date(oldestEntry.posted_at).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOverdue <= 0) continue;

      // Calculate interest (prime + 2% = 13.5% per annum, daily)
      const annualRate = 13.5;
      const dailyRate = annualRate / 365 / 100;
      const interestAmount = Math.round(balance * dailyRate * daysOverdue * 100) / 100;

      // Create interest charge suggestion
      if (interestAmount > 10) {
        const { data: existingInterest } = await supabase
          .from('interest_charges')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('status', 'draft')
          .single();

        if (!existingInterest) {
          await supabase.from('interest_charges').insert({
            entity_id: entityId,
            tenant_id: tenantId,
            lease_id: lease.id,
            amount: interestAmount,
            description: `Interest on overdue balance — ${daysOverdue} days`,
            days_late: daysOverdue,
            status: 'draft',
            period: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
          });
          interestCount++;
        }
      }

      // Calculate late fee (from lease rules or default R350)
      const lateFeeAmount = 350;
      if (daysOverdue >= 7) {
        const { data: existingLateFee } = await supabase
          .from('late_fee_charges')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('status', 'draft')
          .single();

        if (!existingLateFee) {
          await supabase.from('late_fee_charges').insert({
            entity_id: entityId,
            tenant_id: tenantId,
            lease_id: lease.id,
            amount: lateFeeAmount,
            description: `Late payment fee — ${daysOverdue} days overdue`,
            status: 'draft',
            period: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
          });
          lateFeeCount++;
        }
      }
    }

    if (interestCount > 0 || lateFeeCount > 0) {
      await publish('revenue.charges.suggested', {
        correlationId: crypto.randomUUID(),
        source: 'interest-engine',
        version: '1.0',
        payload: { entityId, interestCount, lateFeeCount },
      });
    }

    return { interestCharges: interestCount, lateFees: lateFeeCount };
  },

  async approveCharge(chargeId: string, type: 'interest' | 'late_fee'): Promise<void> {
    const table = type === 'interest' ? 'interest_charges' : 'late_fee_charges';
    await supabase.from(table).update({ status: 'posted' }).eq('id', chargeId);
  },

  async rejectCharge(chargeId: string, type: 'interest' | 'late_fee'): Promise<void> {
    const table = type === 'interest' ? 'interest_charges' : 'late_fee_charges';
    await supabase.from(table).update({ status: 'rejected' }).eq('id', chargeId);
  }
};
